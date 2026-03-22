export const EXAMPLE_INPUT = `Entity: Warehouse
- WarehouseID (key)
- Name

Entity: Product
- SKU (key)
- ProductName

Entity: Client
- ClientID (key)
- Email

Entity: Employee
- EmployeeID (key)
- FullName

WeakEntity: StockAudit
- AuditDate (partial-key)
- Notes

Relationship: Stores
- Warehouse -> Product -> Client
- Warehouse: 0 to m
- Product: 0 to m
- Client: 0 to m
- Quantity

Relationship: Has
- Warehouse -> Employee
- left: 1 to m
- right: 0 to 1

IdentifyingRelationship: AuditedIn
- Warehouse -> StockAudit
- left: 0 to m
- right: 1 to 1`;
