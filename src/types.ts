export type RoutePath =
  | "/"
  | "/more"
  | "/about-us"
  | "/programs"
  | "/private-lessons"
  | "/classes"
  | "/shop"
  | "/cart"
  | "/checkout"
  | "/my-account"
  | "/contact-us"
  | "/terms-and-conditions";

export interface Program {
  slug: string;
  title: string;
  shortDescription: string;
  detail: string;
  imageAlt: string;
}

export interface Benefit {
  title: string;
  summary: string;
  detail: string;
}

export interface Instructor {
  name: string;
  role: string;
  highlights: string[];
  bio: string;
  imageAlt: string;
}

export interface Testimonial {
  name: string;
  excerpt: string;
}

export interface ProductCategory {
  slug: string;
  name: string;
  productSlugs: string[];
}

export interface Product {
  slug: string;
  name: string;
  categories: string[];
  price: number;
  displayPrice: string;
  type?: "product" | "booking";
  description: string;
  sku: string;
  imageAlt: string;
  relatedSlugs: string[];
}

export interface ClassRule {
  id: string;
  title: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  description: string;
  ageNote?: string;
}

export interface ClassEvent {
  id: string;
  ruleId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  ageNote?: string;
}

export interface TermSection {
  title: string;
  content: string;
}

export interface AppTopic {
  slug: string;
  label: string;
  summary: string;
  path: string;
  tone: string;
  group: "student" | "parent";
}

export interface BeltRank {
  slug: string;
  name: string;
  color: string;
  textColor: string;
  level: string;
  focus: string;
  meaning: string;
  classesRequired: number;
}

export interface BeltReadinessItem {
  id: string;
  label: string;
  detail: string;
}

export interface CartItem {
  id: string;
  productSlug: string;
  name: string;
  unitPrice: number;
  displayPrice: string;
  quantity: number;
  booking?: BookingDetails;
}

export interface BookingDetails {
  persons: number;
  date: string;
  time: string;
  timezone: "America/Chicago";
}

export interface Coupon {
  code: string;
  amount: number;
  valid: boolean;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  coupon?: Coupon;
  notes: string;
  pickupOption: string;
  status: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
}

export interface AccountSession {
  email: string;
  remembered: boolean;
  createdAt: string;
}

export type AccountRole = "guardian" | "student" | "staff";

export type ManagerAccessKey =
  | "dashboard"
  | "messages"
  | "students"
  | "classes"
  | "studyGuide"
  | "events"
  | "scheduling"
  | "merchandise"
  | "videos"
  | "reports"
  | "create";

export interface ManagedAccount {
  id: string;
  displayName: string;
  username: string;
  password: string;
  role: "staff" | "student";
  status: "active" | "inactive";
  email?: string;
  phone?: string;
  title?: string;
  notes?: string;
  access: ManagerAccessKey[];
  studentId?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ChildAccount {
  id: string;
  parentEmail: string;
  name: string;
  username: string;
  password?: string;
  age: string;
  beltSlug: string;
  createdAt: string;
}

export interface SearchResult {
  title: string;
  subtitle: string;
  path: string;
  type: string;
}

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone: string;
  email: string;
  profileImagePath?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  enrollmentDate?: string;
  program?: string;
  status?: string;
  beltRank: string;
  classesAttended: number;
  missedClassCount: number;
  lastCheckIn?: string;
  lastContactedAt?: string;
  joinedAt: string;
  notes?: string;
}

export interface ScheduledClass {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  recurring?: boolean;
  titleColor?: string;
  studentId?: string;
  notes?: string;
}

export type ClassWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface StudioClass {
  id: string;
  name: string;
  daysOfWeek: ClassWeekday[];
  startTime: string;
  endTime: string;
  recurring?: boolean;
  titleColor?: string;
  notes?: string;
}

export interface MessageCampaign {
  id: string;
  title: string;
  body: string;
  audience: "all-students" | "missed-classes" | "new-students";
  createdAt: string;
}

export interface MessageLog {
  id: string;
  kind: "welcome" | "reminder" | "follow-up" | "marketing";
  recipientName: string;
  recipientPhone: string;
  body: string;
  status: "queued" | "sent";
  createdAt: string;
  campaignId?: string;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: string;
  status: "sent";
}

export interface StudioEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  details: string;
  audience: "students" | "families" | "public";
}

export interface TrainingVideoFolder {
  id: string;
  name: string;
  subject: string;
  description?: string;
  createdAt: string;
}

export interface TrainingVideo {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  videoDataUrl: string;
  createdAt: string;
}

export interface StudyGuideFolder {
  id: string;
  name: string;
  subject: string;
  parentId?: string;
  description?: string;
  createdAt: string;
}

export interface StudyGuideMaterial {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  fileDataUrl: string;
  createdAt: string;
}

export interface MerchandiseItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageLabel: string;
  imageDataUrl?: string;
}

export interface StudentCheckIn {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  beltRank: string;
}
