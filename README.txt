VISHU PORTFOLIO - FILES

index.html     Home page (hero, marquee and Work section)
about.html     About page
services.html  Services page
store.html     Store page (login required; packages come from the admin panel)
contact.html   Contact page
legal.html     Terms of service and privacy policy
admin.html     Admin dashboard (only vishwajeetp268@gmail.com can open it)

FOLDER STRUCTURE
  index.html, about.html, services.html, store.html, contact.html,
  legal.html, admin.html    HTML pages (in the main folder)
  css/common.css            styles shared by the public pages (loaded first)
  css/                      one stylesheet per page (name matches the page)
  js/                       one script per page (name matches the page)
  Keep this folder layout as it is so the links and styles load.

HOW TO OPEN
Open index.html in a browser. Keep all files in the same folder so links work.

ADMIN LINK
The "Admin" link appears in the menu only when the admin email is logged in on
that browser. Visitors never see it.

ADMIN PANEL FEATURES
- Packages: add, edit, duplicate, reorder, delete, optional image.
- Messages: contact form messages, read/unread, reply by email.
- Orders: create orders, status, payments (partial payments supported), email the client.
- Blog: write posts (draft or published). Published posts show on blog.html.
- Analytics: page views for the last 7, 30 or 90 days, with top pages.
- Settings: contact email, Discord/GitHub/LinkedIn links, footer tagline.
- Accounts: list of clients, delete an account.
- Backup: JSON export and import for packages.

EMAIL SETUP (needed before "Send email" works)
- Create a free account at resend.com and make an API key.
- In Supabase: Project Settings > Edge Functions > Secrets, add:
    RESEND_API_KEY = your Resend API key
    EMAIL_FROM     = a verified sender, e.g. Vishu <hello@yourdomain.com>
- Until these are set, sending shows an error and nothing is sent.

DATABASE (SUPABASE)
- Project: Portfolio store (ap-south-1). Connection details are in js/db.js.
- Accounts: Supabase Auth (email + password). Passwords are never stored in the site.
- Packages: table "packages". Logged-in users can read them. Only the admin can change them.
- Admin: the admin email gets admin rights only after it is confirmed. Rules are enforced
  in the database (Row Level Security), so the browser check is only for showing the menu.
- Client list: table "profiles" (admin can read it). Accounts are deleted from the
  Supabase dashboard (Authentication > Users).

SUPABASE SETTINGS TO CHECK
- Authentication > Sign In / Providers > Email: keep "Confirm email" ON.
  The admin rights depend on it.
- Authentication > URL Configuration: set the Site URL to your live website address,
  so the confirmation link opens the right site.
- For real use, set up a custom SMTP sender (Authentication > Emails). The built-in
  email sender is limited to a few emails per hour.

Keep a JSON backup from the admin Backup tab.
- The contact form is a demo and does not send email yet.

NEW FEATURES (this version)
- Forgot password: Store login page > "Forgot password?" sends a reset email. The link opens reset.html.
- My orders (orders.html): clients see their orders, pay by UPI (QR is made from the UPI ID in
  Settings), upload the screenshot and enter the UTR number. The admin approves it in the
  Orders tab ("Payments to approve"). Approved payments are recorded automatically.
- Order online: packages with an "Online price" show an "Order online" button.
- Extras: each package can show a "Not included" note.
- Services FAQ, dark mode toggle, favicon, SEO tags, 404 page, blog formatting
  (## heading, **bold**, - lists, [link](https://...)).

SETUP FOR THESE FEATURES
- Admin > Settings: enter your UPI ID (name@bank) and payee name. Customers pay to this ID.
- Supabase > Authentication > URL Configuration > Redirect URLs: add
  https://YOUR-DOMAIN/reset.html, otherwise the reset link will not work.
- Payment screenshots are stored in a private bucket (payment-proofs). Only the client
  who uploaded them and the admin can open them.
- The QR library is qr-creator 1.0.0 from jsDelivr. The UPI QR works offline after first load.

CART AND CHECKOUT (this version)
- Store: "Add to cart" puts a package in the cart. Nothing is ordered yet.
- Checkout (checkout.html): shows the cart with database prices. "Place order" creates
  the orders as unpaid. The cart is kept in the browser.
- If the same package is already waiting for payment, the existing order is used. No duplicates.
- My orders: unpaid orders can be cancelled with "Cancel order". After a payment has started,
  the client must contact you to cancel.
- The Store has links to My orders and Cart in the top bar after login.

SECURITY CHECKLIST
Done in code and database:
- Every table has Row Level Security. Admin-only data (orders, payments, messages,
  profiles, email log) cannot be read or changed by visitors.
- Admin rights are checked on the server (is_admin), not in the browser.
- Contact form and page views are rate limited (3 messages per email per hour,
  300 page views per minute site-wide).
- Package images: only PNG, JPEG, WebP or GIF, max 2 MB.
- Content Security Policy on every page blocks injected scripts and unknown hosts.
- Links from Settings must start with https:// (or mailto: for the email).
- Admin page is hidden from search engines (noindex).
- Old browser-stored accounts and password hashes are removed from visitors' browsers.
- Security headers (_headers file) work on Netlify and Cloudflare Pages. Other hosts
  need the same headers set in their settings.

To do in the Supabase dashboard:
- Authentication > Providers > Email: turn ON "Leaked password protection".
- Authentication > Providers > Email: minimum password length 8 or more.
- Keep "Confirm email" ON.
- Never share the service_role key. Only the publishable key is in the site code.

PACKAGE PHOTO GALLERY (this version)
- Admin > Packages: "Photos" accepts several files at once (up to 8 per package).
  Use the arrows to set the order. The first photo is the cover.
  Each photo must be PNG, JPG, WebP or GIF, up to 2 MB.
- Store: each package shows its photos with previous/next buttons and thumbnails.
  Click a photo to open it full size. Use the arrow keys or Esc in the preview.
- Photos are saved in the "package_images" table and the "package-images" bucket.
