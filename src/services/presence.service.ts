import { CompanyRepository } from "@/repositories/company.repository";
import { getPageVisitsCollection } from "@/repositories/collections/customer.collections";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

export interface UserPresence {
  userId: string;
  userName: string;
  phoneNumber?: string;
  companyId?: string;
  companyName?: string;
  currentPath: string;
  platform: "web" | "ios" | "android" | string;
  lastSeen: number; // Date.now()
  role: string;
}

export class PresenceService {
  private presences: Map<string, UserPresence> = new Map();
  private companyNameCache: Map<string, string> = new Map();
  private lastLoggedPath: Map<string, string> = new Map();
  private companyRepo = new CompanyRepository();
  // 75 saniye: Heartbeat 30-45 sn olduğu için 75 saniye offline tespiti için idealdir
  private readonly TIMEOUT_MS = 75 * 1000;

  async recordHeartbeat(data: {
    userId: string;
    userName: string;
    phoneNumber?: string;
    companyId?: string;
    currentPath: string;
    platform: string;
    role: string;
  }): Promise<void> {
    try {
      const path = data.currentPath || "/";
      let companyName = data.companyId ? this.companyNameCache.get(data.companyId) : undefined;

      if (data.companyId && !companyName) {
        try {
          const company = await this.companyRepo.findById(data.companyId);
          if (company?.name) {
            companyName = company.name;
            this.companyNameCache.set(data.companyId, company.name);
          }
        } catch {
          // ignore company lookup error
        }
      }

      this.presences.set(data.userId, {
        userId: data.userId,
        userName: data.userName,
        phoneNumber: data.phoneNumber,
        companyId: data.companyId,
        companyName,
        currentPath: path,
        platform: data.platform || "web",
        lastSeen: Date.now(),
        role: data.role,
      });

      // Eğer sayfa değiştiyse veya ilk defa geliyorsa sayfa ziyaretini kalıcı log olarak kaydet
      const previousLoggedPath = this.lastLoggedPath.get(data.userId);
      if (previousLoggedPath !== path && data.companyId) {
        await this.recordPageVisit({
          userId: data.userId,
          userName: data.userName,
          userRole: data.role,
          phoneNumber: data.phoneNumber,
          companyId: data.companyId,
          path,
          platform: data.platform || "web",
        });
      }
    } catch (error) {
      logger.error("Failed to record user presence heartbeat", error);
    }
  }

  async recordPageVisit(data: {
    userId: string;
    userName: string;
    userRole?: string;
    phoneNumber?: string;
    companyId: string;
    path: string;
    platform: string;
  }): Promise<void> {
    try {
      if (!data.companyId || !data.path) return;

      const today = format(new Date(), "yyyy-MM-dd");
      const collection = getPageVisitsCollection(data.companyId);

      await collection.insertOne({
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole || "user",
        phoneNumber: data.phoneNumber,
        path: data.path,
        platform: data.platform,
        date: today,
        createdAt: Timestamp.now(),
      });

      this.lastLoggedPath.set(data.userId, data.path);
    } catch (error) {
      logger.error("Failed to record page visit", error, {
        userId: data.userId,
        companyId: data.companyId,
        path: data.path,
      });
    }
  }

  getActivePresences(): UserPresence[] {
    const now = Date.now();
    const active: UserPresence[] = [];

    for (const [userId, presence] of this.presences.entries()) {
      if (now - presence.lastSeen <= this.TIMEOUT_MS) {
        active.push(presence);
      } else {
        // Eski oturumları temizle
        this.presences.delete(userId);
      }
    }

    // En son işlem yapan kullanıcı en üstte görünsün
    return active.sort((a, b) => b.lastSeen - a.lastSeen);
  }

  setUserOffline(userId: string): void {
    this.presences.delete(userId);
    this.lastLoggedPath.delete(userId);
  }
}

export const presenceService = new PresenceService();
