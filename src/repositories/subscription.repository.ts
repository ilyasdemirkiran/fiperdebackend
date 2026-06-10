import type {Collection, Filter} from "mongodb";
import {getCoreDatabase} from "@/config/database";
import type {Subscription} from "@/types/subscription/subscription";
import {getSubscriptionCollection} from "@/repositories/collections/core.collections";

export class SubscriptionRepository {

  constructor() {
  }

  private getCollection(): Collection<Subscription> {
    return getSubscriptionCollection();
  }

  async create(subscription: Omit<Subscription, "_id">): Promise<Subscription> {
    const result = await this.getCollection().insertOne(subscription as any);
    return {...subscription, _id: result.insertedId} as Subscription;
  }

  async delete(companyId: string): Promise<boolean> {
    const result = await this.getCollection().deleteOne({companyId: companyId} as Filter<Subscription>);

    return result.deletedCount > 0;
  }

  async findByCompanyId(companyId: string): Promise<Subscription | null> {
    const doc = await this.getCollection().findOne({companyId: companyId} as Filter<Subscription>);

    return doc as Subscription | null;
  }

}