export interface Enrollment {
  course_id: number;
  customer_id: number;
  registration_date: string;
  expiry_date: string;
  status: string;
  created: boolean;
  id?: number;
}
