export const EXAMPLE_INPUT = `Entity: Library
- LibraryID (key)
- Name
- Phone (multivalued)

Entity: Book
- ISBN (key)
- Title
- ShelfLocation (composite)
    - Room
    - Aisle
    - Shelf

Entity: Member
- MemberID (key)
- FullName
- CurrentFine (derived)

WeakEntity: Loan
- LoanNumber (partial-key)
- DueDate
- ReturnDate

Relationship: Holds
- Library -> Book
- left: 1 to m
- right: 0 to m

Relationship: Borrows
- Library -> Book -> Member
- Library: 0 to m
- Book: 0 to m
- Member: 0 to m
- BorrowedOn

IdentifyingRelationship: Records
- Member -> Loan
- left: 0 to m
- right: 1 to 1`;
