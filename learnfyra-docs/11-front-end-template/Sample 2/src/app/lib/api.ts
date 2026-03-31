/**
 * API Utility Functions
 * 
 * This file provides a template for making API calls to your backend.
 * Replace the mock implementations with actual fetch calls to your backend.
 * 
 * SETUP:
 * 1. Create a .env file in the root directory
 * 2. Add: VITE_API_BASE_URL=http://your-backend-url.com/api
 * 3. Import and use these functions in your components
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Add authentication header if needed
      // 'Authorization': `Bearer ${getAuthToken()}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// ==================== WORKSHEET APIs ====================

export async function fetchWorksheets(params?: {
  subject?: string;
  grade?: number;
  difficulty?: string;
  search?: string;
}) {
  // TODO: Implement actual API call
  // return apiCall('/worksheets?' + new URLSearchParams(params as any));
  
  console.log('fetchWorksheets called with params:', params);
  throw new Error('Not implemented - connect to your backend');
}

export async function fetchWorksheetById(id: string) {
  // TODO: Implement actual API call
  // return apiCall(`/worksheets/${id}`);
  
  console.log('fetchWorksheetById called with id:', id);
  throw new Error('Not implemented - connect to your backend');
}

export async function createWorksheet(data: any) {
  // TODO: Implement actual API call
  // return apiCall('/worksheets', {
  //   method: 'POST',
  //   body: JSON.stringify(data),
  // });
  
  console.log('createWorksheet called with data:', data);
  throw new Error('Not implemented - connect to your backend');
}

export async function submitWorksheet(worksheetId: string, answers: any[]) {
  // TODO: Implement actual API call
  // return apiCall(`/worksheets/${worksheetId}/submit`, {
  //   method: 'POST',
  //   body: JSON.stringify({ answers }),
  // });
  
  console.log('submitWorksheet called:', { worksheetId, answers });
  throw new Error('Not implemented - connect to your backend');
}

// ==================== AI APIs ====================

export async function generateQuestionsWithAI(params: {
  subject: string;
  grade: number;
  difficulty: string;
  prompt: string;
  count?: number;
}) {
  // TODO: Implement actual API call to your AI service
  // return apiCall('/ai/generate-questions', {
  //   method: 'POST',
  //   body: JSON.stringify(params),
  // });
  
  console.log('generateQuestionsWithAI called with params:', params);
  throw new Error('Not implemented - connect to your AI backend');
}

export async function getAIHelp(questionId: string, questionText: string) {
  // TODO: Implement actual API call to your AI service
  // return apiCall('/ai/help', {
  //   method: 'POST',
  //   body: JSON.stringify({ questionId, questionText }),
  // });
  
  console.log('getAIHelp called:', { questionId, questionText });
  throw new Error('Not implemented - connect to your AI backend');
}

// ==================== STUDENT APIs ====================

export async function fetchStudentDashboard(studentId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/students/${studentId}/dashboard`);
  
  console.log('fetchStudentDashboard called with id:', studentId);
  throw new Error('Not implemented - connect to your backend');
}

export async function fetchStudentPerformance(studentId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/students/${studentId}/performance`);
  
  console.log('fetchStudentPerformance called with id:', studentId);
  throw new Error('Not implemented - connect to your backend');
}

// ==================== TEACHER APIs ====================

export async function fetchTeacherDashboard(teacherId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/teachers/${teacherId}/dashboard`);
  
  console.log('fetchTeacherDashboard called with id:', teacherId);
  throw new Error('Not implemented - connect to your backend');
}

export async function fetchTeacherStudents(teacherId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/teachers/${teacherId}/students`);
  
  console.log('fetchTeacherStudents called with id:', teacherId);
  throw new Error('Not implemented - connect to your backend');
}

// ==================== PARENT APIs ====================

export async function fetchParentChildren(parentId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/parents/${parentId}/children`);
  
  console.log('fetchParentChildren called with id:', parentId);
  throw new Error('Not implemented - connect to your backend');
}

export async function fetchChildPerformance(childId: string) {
  // TODO: Implement actual API call
  // return apiCall(`/children/${childId}/performance`);
  
  console.log('fetchChildPerformance called with id:', childId);
  throw new Error('Not implemented - connect to your backend');
}

// ==================== AUTHENTICATION APIs ====================

export async function login(email: string, password: string) {
  // TODO: Implement actual API call
  // return apiCall('/auth/login', {
  //   method: 'POST',
  //   body: JSON.stringify({ email, password }),
  // });
  
  console.log('login called with:', { email });
  throw new Error('Not implemented - connect to your backend');
}

export async function logout() {
  // TODO: Implement actual API call
  // return apiCall('/auth/logout', { method: 'POST' });
  
  console.log('logout called');
  throw new Error('Not implemented - connect to your backend');
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'parent';
}) {
  // TODO: Implement actual API call
  // return apiCall('/auth/register', {
  //   method: 'POST',
  //   body: JSON.stringify(data),
  // });
  
  console.log('register called with:', data);
  throw new Error('Not implemented - connect to your backend');
}

// ==================== DOWNLOAD APIs ====================

export async function downloadWorksheetPDF(worksheetId: string) {
  // TODO: Implement actual API call that returns a blob
  // const blob = await fetch(`${API_BASE_URL}/worksheets/${worksheetId}/pdf`).then(r => r.blob());
  // const url = window.URL.createObjectURL(blob);
  // const a = document.createElement('a');
  // a.href = url;
  // a.download = `worksheet-${worksheetId}.pdf`;
  // a.click();
  
  console.log('downloadWorksheetPDF called with id:', worksheetId);
  throw new Error('Not implemented - connect to your backend');
}
