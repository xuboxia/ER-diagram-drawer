export const EXAMPLE_INPUT = `Entity: Library
- LibraryID (key)
- Name
- Address

Entity: Book
- ISBN (key)
- Title
- Genre

Entity: Member
- MemberID (key)
- FullName
- Email

Relationship: Registers
- Library -> Member
- left: 0..m
- right: 1..1

Relationship: Stores
- Library -> Book
- left: 1..m
- right: 0..m`;
