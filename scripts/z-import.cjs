/* /z prior-ийн карт импорт: 1pct_worldview_cards_v2.jsonl → zpersonas (зөвхөн шошго, бичвэргүй). */
const fs = require("fs");
const mongoose = require("mongoose");
const file = process.argv[2];
const ks = (a) => (Array.isArray(a) ? a.map((x) => (typeof x === "string" ? x : x && x.k)).filter(Boolean) : []);
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection("zpersonas");
  const ops = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const c = JSON.parse(line);
    const doc = {
      pid: c.id,
      archetype: c.agent?.archetype || null,
      resolution: c.cognition?.resolution || null,
      stage: c.readiness?.stage || null,
      blocks: ks(c.readiness?.blocks),
      focus: ks(c.readiness?.focus),
      beliefs: ks(c.worldview?.beliefs),
      drivers: ks(c.desire?.drivers),
      entry: ks(c.agent?.entry_chain),
      locus: c.worldview?.locus || null,
      domains: ks(c.identity?.domains),
      offer: c.offer?.type || null,
      abroad: !!c.identity?.abroad,
      ageBand: c.identity?.age_band || null,
    };
    ops.push({ updateOne: { filter: { pid: doc.pid }, update: { $set: doc }, upsert: true } });
  }
  const r = await col.bulkWrite(ops);
  await col.createIndex({ pid: 1 }, { unique: true });
  await col.createIndex({ archetype: 1 });
  await col.createIndex({ resolution: 1 });
  await col.createIndex({ stage: 1 });
  console.log("rows", ops.length, "upserted", r.upsertedCount, "modified", r.modifiedCount, "total", await col.countDocuments());
  const arch = await col.aggregate([{ $group: { _id: "$archetype", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  console.log(JSON.stringify(arch));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
