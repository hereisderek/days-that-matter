# China (Mainland) Region

Status: research notes and plan, checked 2026-10-12. Not part of the first launch. A China launch gets its own OpenSpec change once the open points in section 6 are answered. Architecture it builds on: [`BACKEND.md`](BACKEND.md) section 16; decision: design D16 of the change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/design.md).

---

## 1. Why a separate region

The global deployment cannot serve mainland China well or legally:

| Area | Problem in mainland China |
| :--- | :--- |
| Google | Google services and Google Play are unavailable. No Google sign-in, no Play Billing, no Firebase. |
| Cloudflare | Cloudflare serves from inside China only through its partner JD Cloud, which needs an ICP number and content vetting. Without it, Chinese visitors reach edges outside China: slower and not reliable. |
| Vercel, Firebase | Same reachability problem; Firebase is a Google service. |
| RevenueCat | Its API host has been reported DNS-blocked from mainland China, and it does not support Huawei AppGallery. This is one reason purchases are verified natively (design D14). |
| Spotify | Not available in China. |
| App Store | Apple's China storefront needs an MIIT app filing (ICP filing number in App Store Connect). In practice this needs a Chinese company or a local publisher, with the backend hosted in China. |
| Personal data | PIPL: transferring Chinese users' personal data abroad needs a legal route (CAC security assessment, standard contract filing, or certification) plus separate consent. Keeping the data in China avoids this. |

So China is its own region: own domain, own data, own settings, same app and same backend core.

---

## 2. What the global design already does for this

- One backend core with provider variants: China runs the **self-host variant** on a mainland cloud (Alibaba Cloud or Tencent Cloud), with no code fork.
- `GET /config` reports a region's sign-in methods, stores and features, so the same app hides Google sign-in, Google Play purchases and Spotify in China.
- Sign-in methods are plug-ins (`IdentityProvider`): China adds phone codes and WeChat without touching the global ones.
- Purchases are verified natively (`PurchaseVerifier` plug-ins): Apple verification works from a China-hosted backend; Chinese Android stores are added as more verifiers.
- Mail is a port: China uses a domestic mail service.
- Share pages load no third-party scripts, fonts or analytics; fonts are self-hosted.

---

## 3. Plan for the China region

| Topic | Plan |
| :--- | :--- |
| Hosting | Self-host variant (Node, SQLite on a volume) on Alibaba Cloud ECS or Tencent Cloud Lighthouse, mainland region. Domestic CDN for backdrops and static files. |
| Domain | Separate domain with ICP filing. Share pages, invites and member pages live there. |
| Data | All China accounts and events stay in China. No sync or membership across regions. |
| Sign-in | Sign in with Apple (works in China), email codes (domestic mail service), phone number codes (new `phone` provider and an SMS port), WeChat login later (WeChat Open Platform registration). No Google. |
| Purchases | iOS: App Store in-app purchase, same Apple verifier. Android: no Google Play; each Chinese store (Huawei AppGallery, Xiaomi, OPPO, vivo, Honor) has its own payment SDK, or WeChat Pay and Alipay directly. Start with iOS only, add stores one by one. |
| Android distribution | A separate Android build for Chinese stores (no Google Play Services). |
| Audio | Built-in catalog and custom audio work. No Spotify; links to NetEase Cloud Music or QQ Music could replace it later. |
| Deep links | Universal Links on iOS work. Android App Links on devices without Google Play Services need testing per vendor; the custom scheme is the fallback. |
| Link previews | WeChat is where links get shared. Its in-app browser may warn on domains without ICP filing; the filed domain avoids this. Test previews in WeChat. |
| Content | Public pages show user text and photos. Expect content review duties (text and image moderation, for example Alibaba Cloud or Tencent Cloud moderation services) and possibly real-name (phone) verification for people who publish. Confirm with counsel. |

---

## 4. Cross-region behavior

- A link from the China region opened abroad usually works (mainland servers are reachable from outside).
- A link from the global region opened in China may be slow or fail, because it is served from outside China.
- A person cannot join an event in another region: accounts belong to one region. They can still view public links.

---

## 5. Cost notes

- A small mainland VM plus domestic CDN and SMS costs money from day one; there is no free tier like Cloudflare's.
- ICP filing itself is free but needs a Chinese entity or a publisher, who usually charges.
- Each Chinese Android store integration is separate work.

---

## 6. Open points (to answer before the China change)

1. Chinese company, or a local publisher? Who holds the ICP filing and the app filing?
2. Alibaba Cloud or Tencent Cloud?
3. Which sign-in methods at launch: Apple, email, phone codes, WeChat?
4. iOS only first, or which Android stores?
5. Content review provider, and whether real-name verification is required for public links and comments.
6. Budget for hosting, SMS, CDN, publisher and legal review.

---

## Sources

- RevenueCat community: [mainland China cannot access RevenueCat](https://community.revenuecat.com/general-questions-7/mainland-china-cannot-access-revenuecat-how-to-solve-it-5569), [Huawei in-app purchases](https://community.revenuecat.com/general-questions-7/when-will-revenuecat-support-huawei-in-app-purchases-6742), [country support](https://community.revenuecat.com/featured-articles-55/is-revenuecat-supported-in-my-country-5422).
- Cloudflare: [China Network FAQ](https://developers.cloudflare.com/china-network/faq/).
- App filing: [Apple App Store Connect, app information (ICP)](https://developer.apple.com/help/app-store-connect/reference/app-information/), [Linklaters on the app filing regime](https://techinsights.linklaters.com/post/102j72l/china-the-new-app-filing-regime-keeps-mobile-apps-under-tight-scrutiny), [TechSpot on Apple and the filing law](https://www.techspot.com/news/100368-new-chinese-law-forces-apple-lock-down-regional.html).
- PIPL: [Hawksford PIPL guide](https://www.hawksford.com/insights-and-guides/china-pipl-compliance-guide), [cross-border consent rules](https://seers.ai/blogs/china-data-privacy-2-0-cross-border-consent-rules/).
