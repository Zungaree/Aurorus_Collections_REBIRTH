# Aurorus Connect REBORN - Static E-commerce + Events UI

A framework-free, static HTML/CSS/JS e-commerce UI with Events browsing. Uses only vanilla JavaScript, CSS, and semantic HTML. All data is client-side via JSON files in `assets/` and persisted via `localStorage`.

## Features
- Product catalog with search, filters, sorting, and pagination
- Product detail with stock-aware quantity and pre-order support
- Cart with selection, subtotal of selected items, quantity updates, and removal
- Checkout with shipping and payment validations; simulated order flow
- Events listing with search, multi-filters, sorting, and pagination
- Event detail with an app-gated registration modal (no web registration)
- Responsive, accessible UI; keyboard-friendly controls and visible focus states

## Running locally
This is a static site. Serve it with any static server to avoid CORS issues when fetching JSON:

- VS Code Live Server extension (recommended): Open the project folder and click “Go Live”.
- Python: `python -m http.server 5500` (then open `http://localhost:5500/`)
- Node: `npx http-server -p 5500` (then open `http://localhost:5500/`)

Open `index.html` to get started. Use the navbar to navigate to Products, Cart, Checkout, and Events.

## Data & Storage
- Products data: `assets/products.json`
- Events data: `assets/events.json`
- Cart persistence: `localStorage` key `cartItems`
- Checkout selection: `selectedCartItems`, `selectedCartItemIds`, `cartTotal`

No backend is used. All interactions are client-side.

## Notes
- For pre-order items, stock limits are ignored in this prototype.
- For GCash/PayMaya payments, you can enter a reference number and optionally pick an image to preview; nothing is uploaded.
- Event registration is intentionally gated to the AURORUS mobile app via an install/deep-link modal.

## License
MIT
