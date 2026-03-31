import { Link } from 'react-router';
import {
  Users,
  TrendingUp,
  Clock,
  Award,
  BookOpen,
  AlertCircle,
  ChevronRight,
  Calendar,
  Target,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

export default function ParentDashboard() {
  const childPerformance = [
    { week: 'Week 1', priya: 75, rohan: 82 },
    { week: 'Week 2', priya: 80, rohan: 78 },
    { week: 'Week 3', priya: 85, rohan: 85 },
    { week: 'Week 4', priya: 88, rohan: 83 },
    { week: 'Week 5', priya: 92, rohan: 90 },
  ];

  const subjectStrength = [
    { subject: 'Math', priya: 92, rohan: 88 },
    { subject: 'Science', priya: 85, rohan: 92 },
    { subject: 'English', priya: 95, rohan: 78 },
    { subject: 'Social', priya: 78, rohan: 85 },
    { subject: 'Hindi', priya: 88, rohan: 80 },
  ];

  const children = [
    {
      name: 'Priya Sharma',
      grade: '7',
      avatar: 'PS',
      worksheets: 24,
      avgScore: 92,
      studyTime: '15.5h',
      streak: 7,
    },
    {
      name: 'Rohan Sharma',
      grade: '5',
      avatar: 'RS',
      worksheets: 18,
      avgScore: 86,
      studyTime: '12.2h',
      streak: 5,
    },
  ];

  const recentActivity = [
    {
      child: 'Priya',
      activity: 'Completed Algebra worksheet',
      score: 92,
      subject: 'Math',
      time: '2 hours ago',
      color: 'blue',
    },
    {
      child: 'Rohan',
      activity: 'Started Science assignment',
      progress: 45,
      subject: 'Science',
      time: '3 hours ago',
      color: 'green',
    },
    {
      child: 'Priya',
      activity: 'Earned "7 Day Streak" badge',
      badge: true,
      time: 'Today',
      color: 'purple',
    },
    {
      child: 'Rohan',
      activity: 'Completed English grammar quiz',
      score: 88,
      subject: 'English',
      time: 'Yesterday',
      color: 'blue',
    },
  ];

  const upcomingDeadlines = [
    {
      child: 'Priya',
      title: 'History - Ancient Civilizations',
      subject: 'Social Studies',
      dueDate: 'Tomorrow',
      status: 'not-started',
    },
    {
      child: 'Rohan',
      title: 'Multiplication Tables Practice',
      subject: 'Math',
      dueDate: 'In 2 days',
      status: 'in-progress',
    },
    {
      child: 'Priya',
      title: 'Photosynthesis Quiz',
      subject: 'Science',
      dueDate: 'In 3 days',
      status: 'not-started',
    },
  ];

  const teacherFeedback = [
    {
      child: 'Priya',
      teacher: 'Mr. Rajesh Kumar',
      subject: 'Mathematics',
      feedback:
        'Priya has shown excellent improvement in algebraic concepts. She actively participates in class.',
      date: '2 days ago',
    },
    {
      child: 'Rohan',
      teacher: 'Ms. Anjali Verma',
      subject: 'Science',
      feedback:
        'Rohan is doing well but needs to work on his attention to detail in experiments.',
      date: '5 days ago',
    },
  ];

  return (
    <AppLayout userRole="parent">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome, Mrs. Anjali! 👋
            </h1>
            <p className="text-muted-foreground">
              Track your children's learning progress and achievements
            </p>
          </div>
          <Button size="lg" className="gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Meeting
          </Button>
        </div>

        {/* Children Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {children.map((child, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold text-lg">
                    {child.avatar}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{child.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Grade {child.grade}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  Active
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <BookOpen className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <div className="text-xl font-bold">{child.worksheets}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <div className="text-xl font-bold">{child.avgScore}%</div>
                  <div className="text-xs text-muted-foreground">Avg Score</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                  <div className="text-xl font-bold">{child.studyTime}</div>
                  <div className="text-xs text-muted-foreground">Study Time</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Award className="w-5 h-5 mx-auto mb-1 text-orange-600" />
                  <div className="text-xl font-bold">{child.streak}</div>
                  <div className="text-xs text-muted-foreground">Day Streak</div>
                </div>
              </div>

              <Button variant="outline" className="w-full mt-6 gap-2">
                View Detailed Report
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>

        {/* Performance Charts */}
        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="progress">Progress Trend</TabsTrigger>
            <TabsTrigger value="subjects">Subject Strength</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-4">
            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-1">Weekly Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Comparing average scores over the last 5 weeks
                </p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={childPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="priya"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', r: 4 }}
                    name="Priya"
                  />
                  <Line
                    type="monotone"
                    dataKey="rohan"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    name="Rohan"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="subjects" className="space-y-4">
            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-1">Subject Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Compare strengths across different subjects
                </p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={subjectStrength}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={12} />
                  <PolarRadiusAxis stroke="#64748b" fontSize={12} />
                  <Radar
                    name="Priya"
                    dataKey="priya"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Rohan"
                    dataKey="rohan"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.color === 'blue'
                        ? 'bg-blue-100'
                        : item.color === 'green'
                        ? 'bg-green-100'
                        : 'bg-purple-100'
                    }`}
                  >
                    {item.badge ? (
                      <Award
                        className={`w-5 h-5 ${
                          item.color === 'blue'
                            ? 'text-blue-600'
                            : item.color === 'green'
                            ? 'text-green-600'
                            : 'text-purple-600'
                        }`}
                      />
                    ) : (
                      <BookOpen
                        className={`w-5 h-5 ${
                          item.color === 'blue'
                            ? 'text-blue-600'
                            : item.color === 'green'
                            ? 'text-green-600'
                            : 'text-purple-600'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-1">
                      <span className="text-primary">{item.child}</span>{' '}
                      {item.activity}
                    </p>
                    {item.score && (
                      <Badge variant="outline" className="mr-2">
                        Score: {item.score}%
                      </Badge>
                    )}
                    {item.progress !== undefined && (
                      <div className="mt-2">
                        <Progress value={item.progress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.progress}% complete
                        </p>
                      </div>
                    )}
                    {item.subject && (
                      <Badge variant="secondary" className="text-xs">
                        {item.subject}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 gap-2">
              View All Activity
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Upcoming Deadlines</h3>
            <div className="space-y-4">
              {upcomingDeadlines.map((item, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    item.status === 'not-started'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary mb-1">
                        {item.child}
                      </p>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {item.subject}
                      </Badge>
                    </div>
                    {item.status === 'not-started' && (
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-muted-foreground">
                      Due: {item.dueDate}
                    </span>
                    <Badge
                      variant={
                        item.status === 'not-started' ? 'destructive' : 'default'
                      }
                    >
                      {item.status === 'not-started'
                        ? 'Not Started'
                        : 'In Progress'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Teacher Feedback */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Teacher Feedback</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {teacherFeedback.map((feedback, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-primary">{feedback.child}</p>
                    <p className="text-sm text-muted-foreground">
                      {feedback.teacher} • {feedback.subject}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {feedback.date}
                  </span>
                </div>
                <p className="text-sm">{feedback.feedback}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-6 gap-2">
            Request Meeting with Teachers
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
