# Alcoholic Drinks Carton / Single Unit Implementation Plan

## Goal
Support alcoholic drink inventory and sales as both cartons and single units while keeping stock tracking in base units.

## Why this is needed
Alcoholic products are often purchased and stored by carton, but sold either by the carton or by single bottle/unit. The system must:
- let users record how many units are in a carton when adding alcoholic products,
- convert carton quantities into base-unit stock automatically,
- support sale selection by carton or by single unit,
- keep inventory tracking consistent in base units.

## Data model changes
1. Continue storing `Product.stock` as base units.
2. Use `Product.packageOptions` for packaging choices:
   - `Single Unit` with `unitsPerBase = 1` and `price` = single bottle price
   - `Carton` with `unitsPerBase = unitsPerCarton` and `price` = carton price
3. Ensure product categories include:
   - `Alcoholic`
   - `Non-Alcoholic`
4. No new database columns are required; use the existing `ProductPackageOption` and `SaleItem.packageOptionId` fields.

## Add Product flow
### For alcoholic products
- Require category selection of `Alcoholic`.
- Add form inputs:
  - `Units per Carton`
  - `Initial Cartons`
  - `Bottle Price` (single unit price)
  - `Carton Price`
- Auto-calculate base `stock` as:
  - `stock = Units per Carton * Initial Cartons`
- Create package options for both price points:
  - `Single Bottle` package with `unitsPerBase = 1` and `price = Bottle Price`
  - `Carton` package with `unitsPerBase = Units per Carton` and `price = Carton Price`
- Ignore legacy inventory fields such as `batch number`, `expiry date`, `supplier`, and `cost price` for this flow.

### For non-alcoholic products
- Use the existing stock input flow.
- Support a single package option with `unitsPerBase = 1` and the direct product price.
- Keep category selection limited to `Non-Alcoholic` or `Alcoholic`.

## Sale flow behavior
1. When a sale item is selected and the product category is `Alcoholic`:
   - show a sale-mode control such as a checkbox or radio option:
     - `Sell by carton`
     - `Sell by single bottle`
2. If `Sell by carton` is selected:
   - use the `Carton` package option
   - calculate base quantity as `quantity * unitsPerCarton`
   - charge the sale using the carton package price
3. If `Sell by single bottle` is selected:
   - use the `Single Unit` package option
   - charge unit price and use `quantity` directly
4. Store sale item details in `SaleItem`:
   - `packageOptionId`
   - `packageName`
   - `unitsPerBase`
   - `baseQuantity`
   - `unitPrice`

## UI / UX design
- In product list and add-product screens, keep category selection fixed to `Alcoholic` and `Non-Alcoholic`.
- For alcoholic products, display carton detail fields before stock.
- Show computed stock in units and a helper description: `Stock is auto-calculated from cartons.`
- In the sale page, show a compact toggle or checkbox when an alcoholic product is selected.

## Backend/API updates
- Keep current endpoints for product creation and updates.
- Ensure `createProduct` and `updateProduct` accept `packageOptions`.
- Make sure categories are seeded with `Alcoholic` and `Non-Alcoholic`.
- Use the existing `SaleItem` schema to capture carton vs unit sales.

## Acceptance criteria
- Product categories are restricted to `Alcoholic` and `Non-Alcoholic` in the add/edit form.
- Alcoholic products allow entering carton size, carton quantity, bottle price, and carton price.
- Stock is calculated automatically from carton data for alcoholic products.
- Non-alcoholic products keep the existing direct stock entry flow.
- Sales can distinguish between carton and single-unit sales and compute base stock movement correctly.
- Sale pricing uses the appropriate package price: carton price for cartons, bottle price for single units.

## Next implementation steps
1. Update the add/edit product page to enforce the two category options.
2. Add carton size, initial carton quantity, bottle price, and carton price inputs for alcoholic products.
3. Auto-compute and persist base unit stock from those carton fields.
4. Create both package options for alcoholic products: `Single Unit` and `Carton`.
5. Update the sale page to show carton vs single-unit sale mode for alcoholic items.
6. Test the full flow: add alcoholic product, verify stock, sell carton, sell bottle, and check inventory adjustments.
