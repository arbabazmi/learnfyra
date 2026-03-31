import { Link } from 'react-router';
import {
  Users,
  FileText,
  TrendingUp,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Download,
  Eye,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function TeacherDashboard() {
  const classPerformance = [
    { subject: 'Math', average: 85 },
    { subject: 'Science', average: 78 },
    { subject: 'English', average: 92 },
    { subject: 'History', average: 73 },
    { subject: 'Geography', average: 80 },
  ];

  const submissionData = [
    { name: 'Completed', value: 145, color: '#10b981' },
    { name: 'In Progress', value: 32, color: '#6366f1' },
    { name: 'Not Started', value: 18, color: '#94a3b8' },
  ];

  const recentWorksheets = [
    {
      id: 1,
      title: 'Algebra - Linear Equations',
      subject: 'Mathematics',
      grade: '7A',
      assigned: '45 students',
      completed: 38,
      total: 45,
      avgScore: 85,
      date: '2 days ago',
    },
    {
      id: 2,
      title: 'Cell Biology Basics',
      subject: 'Science',
      grade: '7B',
      assigned: '42 students',
      completed: 42,
      total: 42,
      avgScore: 92,
      date: '4 days ago',
    },
    {
      id: 3,
      title: 'Parts of Speech Review',
      subject: 'English',
      grade: '7A',
      assigned: '45 students',
      completed: 12,
      total: 45,
      avgScore: 78,
      date: 'Today',
    },
  ];

  const topStudents = [
    {
      name: 'Priya Sharma',
      grade: '7A',
      worksheets: 24,
      avgScore: 94,
      avatar: 'PS',
    },
    { name: 'Arjun Patel', grade: '7B', worksheets: 22, avgScore: 91, avatar: 'AP' },
    {
      name: 'Ananya Singh',
      grade: '7A',
      worksheets: 20,
      avgScore: 89,
      avatar: 'AS',
    },
    {
      name: 'Rohan Kumar',
      grade: '7B',
      worksheets: 19,
      avgScore: 88,
      avatar: 'RK',
    },
  ];

  const needsAttention = [
    {
      name: 'Vikram Rao',
      grade: '7A',
      issue: 'Low completion rate (45%)',
      pending: 8,
    },
    { name: 'Meera Joshi', grade: '7B', issue: 'Struggling with Math', pending: 5 },
    {
      name: 'Kabir Mehta',
      grade: '7A',
      issue: 'Not started recent worksheets',
      pending: 6,
    },
  ];

  return (
    <AppLayout userRole="teacher">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, Mr. Rajesh! 👨‍🏫
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your classes today
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              AI Generate
            </Button>
            <Link to="/teacher/create-worksheet">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Create Worksheet
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                2 classes
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">87</div>
            <p className="text-sm text-muted-foreground">Total Students</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-700">
                +5 this week
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">32</div>
            <p className="text-sm text-muted-foreground">Active Worksheets</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                +3% up
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">86%</div>
            <p className="text-sm text-muted-foreground">Class Average</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                Need review
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">12</div>
            <p className="text-sm text-muted-foreground">Pending Reviews</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Class Performance */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Class Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Average scores by subject
                </p>
              </div>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={classPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="subject" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="average" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Submission Status */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Submission Status</h3>
            <div className="flex items-center justify-center mb-6">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={submissionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {submissionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {submissionData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Worksheets */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Recent Worksheets</h2>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search worksheets..." className="pl-9 w-64" />
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
          <div className="grid gap-4">
            {recentWorksheets.map((worksheet) => (
              <Card
                key={worksheet.id}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1">{worksheet.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{worksheet.subject}</span>
                          <span>•</span>
                          <span>Grade {worksheet.grade}</span>
                          <span>•</span>
                          <span>{worksheet.assigned}</span>
                          <span>•</span>
                          <span className="text-muted-foreground">
                            {worksheet.date}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-muted-foreground">
                            Completion
                          </span>
                        </div>
                        <div className="text-xl font-bold">
                          {Math.round((worksheet.completed / worksheet.total) * 100)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {worksheet.completed}/{worksheet.total} students
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-muted-foreground">
                            Avg Score
                          </span>
                        </div>
                        <div className="text-xl font-bold">{worksheet.avgScore}%</div>
                        <div className="text-xs text-muted-foreground">
                          Class average
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-orange-600" />
                          <span className="text-xs text-muted-foreground">Pending</span>
                        </div>
                        <div className="text-xl font-bold">
                          {worksheet.total - worksheet.completed}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Students left
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex lg:flex-col gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Top Performers</h3>
            <div className="space-y-4">
              {topStudents.map((student, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold text-sm">
                        {student.avatar}
                      </div>
                      {index < 3 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Grade {student.grade}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {student.avgScore}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {student.worksheets} worksheets
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Needs Attention */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Needs Attention</h3>
            <div className="space-y-4">
              {needsAttention.map((student, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg bg-orange-50 border border-orange-200"
                >
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Grade {student.grade}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-white">
                        {student.pending} pending
                      </Badge>
                    </div>
                    <p className="text-sm text-orange-800">{student.issue}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    Contact
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
