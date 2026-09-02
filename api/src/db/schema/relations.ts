import { defineRelations } from "drizzle-orm/relations";
import { batchTable } from "./batches.js";
import { urlTable } from "./url.js";

export const relations = defineRelations({ batchTable, urlTable }, (r) => ({
  batchTable: {
    urls: r.many.urlTable(),
  },
  urlTable: {
    batch: r.one.batchTable({
      from: r.urlTable.batchId,
      to: r.batchTable.id,
      optional: false,
    }),
  },
}));