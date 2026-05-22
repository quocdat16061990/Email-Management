export interface Course {
  id: number;
  name: string;
  spotlight_id: string;
  description: string;
  web_link: string;
  links: CourseLink[];
  created_at?: string;
  student_count?: number;
}

export interface CourseLink {
  title: string;
  url: string;
}

export interface VoomlyStudent {
  email: string;
  name: string;
  registration_date: string;
  expiry_date: string;
  status: string;
}
