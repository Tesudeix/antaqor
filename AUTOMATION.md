# ANTAQOR Automation — Architecture (Comment-Order Bot)

## Нэг модуль: /admin/automation

Хуучин 4 хуудас (Flow Builder /admin/flows · Social Auto · Тавтай морил /admin/welcome · Триггер /admin/triggers) → **нэг nav item, 3 таб**:

| Таб | Юу | Хадгалагдах газар |
|---|---|---|
| Ботууд | Comment→DM→захиалгын ботууд, 4-алхамт wizard | `CommentBot` |
| Захиалгууд | Шинэ→Баталгаажсан→Төлсөн→Хүргэсэн pipeline + transcript drawer | `CommentOrder` |
| Тохиргоо | Welcome toggle+greeting+starters · fallback · төлбөрийн мэдээлэл | `MetaWelcome` (existing) |

## Migration table

| Хуучин feature | Байсан газар | Одоо |
|---|---|---|
| Keyword comment→DM | Триггер (MetaTrigger) | Ботууд (CommentBot). MetaTrigger engine ҮЛДСЭН — Joy Massage/Billiard live ажиллаж байгаа тул устгаагүй; nav-аас хасагдсан, ⌘K-д үгүй |
| DM flow canvas | Flow Builder (MetaFlow) + Social Auto (SocialFlow) | Runtime хоёулаа үлдсэн; canvas нь bot картын "Дэлгэрэнгүй flow засварлагч" линкээр (/admin/social-automation) |
| Welcome/анхны DM | Тавтай морил (MetaWelcome) | Тохиргоо таб (ижил collection — data migration хэрэггүй) |
| Төлбөрийн мэдээлэл | MetaWelcome.payText | Тохиргоо таб 3-р бүлэг; захиалга баталгаажмагц автоматаар илгээгдэнэ |
| /admin/flows, /admin/triggers, /admin/welcome | — | redirect → /admin/automation |
| Инфлюенсер · Trending промпт · AI Мэдээ · Түүхүүд · Бараа | nav + ⌘K | Nav-аас ХАСАГДСАН (route-ууд хэвээр, шууд URL-ээр орж болно) |

## Engine (lib/orderBot.ts)

comment webhook → `processCommentForBots` (бот бүрт: platform+post+keyword match)
→ dedupe `CommentBotHit` unique(bot,post,user) — **нэг хэрэглэгч пост тутамд 1 хариу**
→ public reply (сонголтоор) → private reply DM#1 (24h цонх нээнэ)
→ collectOrders бол `OrderSession` үүсгээд: бүтээгдэхүүн (quick reply `ord:p:i`)
→ тоо (`ord:q:n`) → утас (8 орон, 6/7/8/9; 1 удаа дахин асууж, дараа нь
`phoneUnverified` тэмдэглээд авна) → хаяг → summary + Баталгаажуулах/Засах
→ `CommentOrder` (status: new) + lead tag "захиалга" + payText илгээнэ.
"болих/stop" хэзээд гарна. Бүх шилжилт idempotent (webhook redelivery-д тэсвэртэй).

DM урсгал дахь дараалал: **OrderSession → SocialFlow → MetaFlow → MetaTrigger → Welcome → AI**.
Postback: `ord:` → order engine; `sf:` → SocialFlow; `flow:` → MetaFlow.

## Webhook

`/api/meta/webhook` — X-Hub-Signature-256 шалгадаг (META_APP_SECRET). Fields: comments/feed + messages.
Хязгаарлалт: private reply нь comment-ийн 7 хоногийн дотор; бусад DM 24h цонхонд.
V2 boluulah зүйлс: outgoing очередь + 429 exponential backoff (одоо inline send + lastError surfacing), IG постын thumbnail grid wizard-т.
