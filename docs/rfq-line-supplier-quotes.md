# Supplier quotes per RFQ line — revision-safe sourcing phase

**Status:** implementation adds supplier line pricing for sourcing, not an approved
commercial quotation or purchase order.

## What it enables

- Add a supplier quote against a specific RFQ requirement line (Flyway V13).
- Record unit price in the **RFQ header currency**, minimum order quantity
  in the **line unit**, lead time in days, Incoterm, named port and notes.
- Every resubmission for the same (supplier, product line) creates a new
  numbered revision; previous values are retained, never overwritten.
- List the latest quote for each supplier/line and inspect chronological
  quotation history per line, alongside its recorded actor.
- Reject items from another RFQ, unknown suppliers and quotes submitted outside
  the SOURCING stage.
- Freeze requirement modifications after the first supplier quote revision.
- Block use of the old aggregate supplier-offer model when per-line pricing
  exists (and vice versa). The existing single-header customer quotation,
  sales order and purchase order modules are **not** line aware and must remain
  unavailable for conversions from these new per-line quote records.

## API

```
GET  /api/rfqs/{rfqId}/line-offers
POST /api/rfqs/{rfqId}/line-offers
GET  /api/rfqs/{rfqId}/line-offers/{itemId}/history
```

POST payload:

```json
{
  "itemId": "<RFQ-owned UUID>",
  "supplierId": "<saved supplier UUID>",
  "unitPrice": "499.5000",
  "moq": "10.000",
  "leadDays": 21,
  "incoterm": "FOB",
  "port": "Shanghai, China",
  "notes": "Supplier terms; not a purchase approval"
}
```

Only authenticated ADMIN/MANAGEMENT/BD/SOURCING users have access,
enforced on the backend; writes are audited and serialized on the RFQ row.
The database uses unique revision numbers, foreign keys, and an immutable
revision trigger. Latest quote results are sorted by item and nominal
unit price, **not** by landed cost or commercial suitability.

## Explicitly outside scope

- Tax, customs, freight, insurance, currency conversion, approved vendor checks.
- Quotation attachment upload/retention and document validation.
- Automated "best supplier" award decisions and price commitments.
- Line-to-customer-quote revision, independent approval, purchase order line
  matching, partial shipment allocation, financial postings.
- Production release and SHL live records pending all release/security gates.

Reference: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html),
[Spring transaction annotations](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html),
[Flyway migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html).
