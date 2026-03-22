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

Relationship: Stores
- Library -> Book
- left participation: total
- left arrow: false
- right participation: partial
- right arrow: false

Relationship: Borrows
- Member -> Book
- left participation: partial
- left arrow: false
- right participation: partial
- right arrow: false`;
