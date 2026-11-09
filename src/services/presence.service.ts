import { CompanyRepository } from "@/repositories/company.repository";
import { logger } from "@/utils/logger";

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
        currentPath: data.currentPath || "/",
        platform: data.platform || "web",
        lastSeen: Date.now(),
        role: data.role,
      });
    } catch (error) {
      logger.error("Failed to record user presence heartbeat", error);
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
  }
}

export const presenceService = new PresenceService();

