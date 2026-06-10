import type {
  StructuredAttribute,
  StructuredDiagramModel,
  StructuredEntity,
  StructuredPreset,
  StructuredRelationship,
  StructuredRelationshipParticipant,
} from "../types/structured";
import { createStructuredId } from "../utils/structuredModel";

export const DEFAULT_STRUCTURED_PRESET_ID = "library";

function attribute(
  name: string,
  flags: Partial<Omit<StructuredAttribute, "id" | "name" | "children">> = {},
  children: StructuredAttribute[] = [],
): StructuredAttribute {
  return {
    id: createStructuredId("attribute"),
    name,
    isKey: Boolean(flags.isKey),
    isPartialKey: Boolean(flags.isPartialKey),
    isOptional: Boolean(flags.isOptional),
    isDerived: Boolean(flags.isDerived),
    isMultivalued: Boolean(flags.isMultivalued),
    isComposite: Boolean(flags.isComposite),
    children,
  };
}

function entity(
  name: string,
  attributes: StructuredAttribute[],
  kind: StructuredEntity["kind"] = "strong",
): StructuredEntity {
  return {
    id: createStructuredId("entity"),
    name,
    kind,
    attributes,
  };
}

function participant(
  entityId: string,
  cardinality: StructuredRelationshipParticipant["cardinality"],
  participation: StructuredRelationshipParticipant["participation"],
  roleName = "",
): StructuredRelationshipParticipant {
  return {
    id: createStructuredId("participant"),
    entityId,
    roleName,
    cardinality,
    participation,
  };
}

function relationship(
  name: string,
  degree: StructuredRelationship["degree"],
  participants: StructuredRelationshipParticipant[],
  attributes: StructuredAttribute[] = [],
  kind: StructuredRelationship["kind"] = "regular",
): StructuredRelationship {
  return {
    id: createStructuredId("relationship"),
    name,
    kind,
    degree,
    participants,
    attributes,
  };
}

function createLibraryModel(): StructuredDiagramModel {
  const library = entity("Library", [
    attribute("LibraryID", { isKey: true }),
    attribute("Name"),
    attribute("Address"),
  ]);
  const book = entity("Book", [
    attribute("ISBN", { isKey: true }),
    attribute("Title"),
    attribute("Genre"),
  ]);
  const member = entity("Member", [
    attribute("MemberID", { isKey: true }),
    attribute("FullName"),
    attribute("Email"),
  ]);

  return {
    entities: [library, book, member],
    relationships: [
      relationship("Registers", "binary", [
        participant(library.id, "many", "optional"),
        participant(member.id, "one", "mandatory"),
      ]),
      relationship("Stores", "binary", [
        participant(library.id, "many", "mandatory"),
        participant(book.id, "many", "optional"),
      ]),
    ],
  };
}

function createClinicModel(): StructuredDiagramModel {
  const doctor = entity("Doctor", [
    attribute("DoctorID", { isKey: true }),
    attribute("FullName"),
    attribute("Specialty"),
  ]);
  const patient = entity("Patient", [
    attribute("PatientID", { isKey: true }),
    attribute("FullName"),
    attribute("Address", { isComposite: true }, [
      attribute("Street"),
      attribute("City"),
      attribute("Postcode"),
    ]),
  ]);
  const medicine = entity("Medicine", [
    attribute("MedicineID", { isKey: true }),
    attribute("Name"),
    attribute("DoseForm"),
  ]);

  return {
    entities: [doctor, patient, medicine],
    relationships: [
      relationship("Prescribes", "ternary", [
        participant(doctor.id, "many", "optional"),
        participant(patient.id, "many", "mandatory"),
        participant(medicine.id, "many", "optional"),
      ], [attribute("DateIssued")]),
      relationship("Supervises", "unary", [
        participant(doctor.id, "many", "optional", "Supervisor"),
        participant(doctor.id, "one", "optional", "JuniorDoctor"),
      ]),
    ],
  };
}

function createUniversityModel(): StructuredDiagramModel {
  const student = entity("Student", [
    attribute("StudentID", { isKey: true }),
    attribute("FullName"),
    attribute("Email"),
  ]);
  const course = entity("Course", [
    attribute("CourseCode", { isKey: true }),
    attribute("Title"),
    attribute("CreditPoints"),
  ]);
  const semester = entity("Semester", [
    attribute("SemesterID", { isKey: true }),
    attribute("Year"),
    attribute("Term"),
  ]);

  return {
    entities: [student, course, semester],
    relationships: [
      relationship("EnrollsIn", "ternary", [
        participant(student.id, "many", "optional"),
        participant(course.id, "many", "mandatory"),
        participant(semester.id, "many", "mandatory"),
      ], [attribute("Grade", { isOptional: true })]),
    ],
  };
}

export const STRUCTURED_PRESETS: StructuredPreset[] = [
  {
    id: DEFAULT_STRUCTURED_PRESET_ID,
    name: "Library / Book / Member",
    description: "Neutral binary relationships for the default course example.",
    model: createLibraryModel(),
  },
  {
    id: "clinic",
    name: "Clinic prescribing",
    description: "Includes a ternary relationship and a recursive supervision relationship.",
    model: createClinicModel(),
  },
  {
    id: "university",
    name: "University enrolment",
    description: "A compact ternary example with relationship attributes.",
    model: createUniversityModel(),
  },
];

export function cloneStructuredModel(model: StructuredDiagramModel): StructuredDiagramModel {
  return JSON.parse(JSON.stringify(model)) as StructuredDiagramModel;
}

export function getDefaultStructuredModel(): StructuredDiagramModel {
  const preset = STRUCTURED_PRESETS.find((item) => item.id === DEFAULT_STRUCTURED_PRESET_ID);
  return cloneStructuredModel(preset?.model ?? STRUCTURED_PRESETS[0].model);
}
