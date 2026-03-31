import { Link } from 'react-router';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Award,
  Play,
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  Target,
  Brain,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function StudentDashboard() {
  const performanceData = [
    { day: 'Mon', score: 65 },
    { day: 'Tue', score: 72 },
    { day: 'Wed', score: 85 },
    { day: 'Thu', score: 78 },
    { day: 'Fri', score: 90 },
    { day: 'Sat', score: 88 },
    { day: 'Sun', score: 92 },
  ];

  const recentWorksheets = [
    {
      id: 1,
      title: 'Algebra - Linear Equations',
      subject: 'Mathematics',
      grade: '7',
      difficulty: 'Medium',
      status: 'completed',
      score: 92,
      totalQuestions: 25,
      timeSpent: '45 min',
      date: '2 hours ago',
    },
    {
      id: 2,
      title: 'Photosynthesis & Plant Biology',
      subject: 'Science',
      grade: '7',
      difficulty: 'Easy',
      status: 'in-progress',
      progress: 60,
      completedQuestions: 15,
      totalQuestions: 25,
      timeSpent: '28 min',
      date: 'Today',
    },
    {
      id: 3,
      title: 'Grammar - Active & Passive Voice',
      subject: 'English',
      grade: '7',
      difficulty: 'Hard',
      status: 'not-started',
      totalQuestions: 30,
      estimatedTime: '50 min',
      date: 'Assigned today',
    },
  ];

  const subjectProgress = [
    {
      subject: 'Mathematics',
      progress: 85,
      worksheets: 12,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      subject: 'Science',
      progress: 72,
      worksheets: 8,
      color: 'from-green-500 to-emerald-600',
    },
    {
      subject: 'English',
      progress: 90,
      worksheets: 15,
      color: 'from-purple-500 to-pink-600',
    },
    {
      subject: 'Social Studies',
      progress: 65,
      worksheets: 6,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const aiRecommendations = [
    {
      title: 'Quadratic Equations Practice',
      reason: 'Based on your recent algebra performance',
      difficulty: 'Medium',
      questions: 20,
    },
    {
      title: 'Chemical Reactions Quiz',
      reason: 'Complete your science learning path',
      difficulty: 'Easy',
      questions: 15,
    },
  ];

  const achievements = [
    { icon: Award, label: '7 Day Streak', earned: true },
    { icon: Target, label: '90% Club', earned: true },
    { icon: Brain, label: 'Fast Learner', earned: true },
    { icon: TrendingUp, label: 'Rising Star', earned: false },
  ];

  return (
    <AppLayout userRole="student">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, Priya! 👋</h1>
            <p className="text-muted-foreground">
              You're doing great! Keep up the excellent work.
            </p>
          </div>
          <Button size="lg" className="gap-2">
            <Sparkles className="w-5 h-5" />
            Start New Worksheet
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                +3 this week
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">24</div>
            <p className="text-sm text-muted-foreground">Completed Worksheets</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-700">
                +5% up
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">92%</div>
            <p className="text-sm text-muted-foreground">Average Accuracy</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                7 days
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">15.5h</div>
            <p className="text-sm text-muted-foreground">Study Time</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                3 new
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">18</div>
            <p className="text-sm text-muted-foreground">Achievements</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Performance Trend</h3>
                <p className="text-sm text-muted-foreground">
                  Your scores over the last 7 days
                </p>
              </div>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
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
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Achievements */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Achievements</h3>
            <div className="space-y-3">
              {achievements.map((achievement, index) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      achievement.earned
                        ? 'bg-primary-light border border-primary/20'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        achievement.earned
                          ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]'
                          : 'bg-muted'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          achievement.earned ? 'text-white' : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          achievement.earned ? '' : 'text-muted-foreground'
                        }`}
                      >
                        {achievement.label}
                      </p>
                    </div>
                    {achievement.earned && (
                      <CheckCircle2 className="w-5 h-5 text-[#6366f1]" />
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" className="w-full mt-4 gap-2">
              View All Achievements
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Card>
        </div>

        {/* Recent Worksheets */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Recent Worksheets</h2>
            <Link to="/student/worksheets">
              <Button variant="ghost" className="gap-2">
                View All
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4">
            {recentWorksheets.map((worksheet) => (
              <Card key={worksheet.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          worksheet.status === 'completed'
                            ? 'bg-green-100'
                            : worksheet.status === 'in-progress'
                            ? 'bg-blue-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {worksheet.status === 'completed' ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : worksheet.status === 'in-progress' ? (
                          <Play className="w-6 h-6 text-blue-600" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{worksheet.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{worksheet.subject}</span>
                          <span>•</span>
                          <span>Grade {worksheet.grade}</span>
                          <span>•</span>
                          <Badge
                            variant="outline"
                            className={
                              worksheet.difficulty === 'Easy'
                                ? 'border-green-300 text-green-700'
                                : worksheet.difficulty === 'Medium'
                                ? 'border-orange-300 text-orange-700'
                                : 'border-red-300 text-red-700'
                            }
                          >
                            {worksheet.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {worksheet.status === 'completed' && (
                      <div className="flex items-center gap-6 ml-15 text-sm">
                        <div>
                          <span className="text-muted-foreground">Score: </span>
                          <span className="font-semibold text-green-600">
                            {worksheet.score}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Questions: </span>
                          <span className="font-medium">{worksheet.totalQuestions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time: </span>
                          <span className="font-medium">{worksheet.timeSpent}</span>
                        </div>
                      </div>
                    )}

                    {worksheet.status === 'in-progress' && (
                      <div className="ml-15 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {worksheet.completedQuestions} of {worksheet.totalQuestions}{' '}
                            completed
                          </span>
                          <span className="font-medium">{worksheet.progress}%</span>
                        </div>
                        <Progress value={worksheet.progress} className="h-2" />
                      </div>
                    )}

                    {worksheet.status === 'not-started' && (
                      <div className="flex items-center gap-6 ml-15 text-sm text-muted-foreground">
                        <div>
                          <span>Questions: </span>
                          <span className="font-medium text-foreground">
                            {worksheet.totalQuestions}
                          </span>
                        </div>
                        <div>
                          <span>Est. Time: </span>
                          <span className="font-medium text-foreground">
                            {worksheet.estimatedTime}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {worksheet.date}
                    </span>
                    <Button
                      className={
                        worksheet.status === 'completed'
                          ? 'bg-green-600 hover:bg-green-700'
                          : worksheet.status === 'in-progress'
                          ? ''
                          : 'bg-gray-600 hover:bg-gray-700'
                      }
                    >
                      {worksheet.status === 'completed'
                        ? 'Review'
                        : worksheet.status === 'in-progress'
                        ? 'Continue'
                        : 'Start'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Subject Progress & AI Recommendations */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Subject Progress */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Subject Progress</h3>
            <div className="space-y-6">
              {subjectProgress.map((subject, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${subject.color} flex items-center justify-center text-white font-semibold text-sm`}
                      >
                        {subject.subject[0]}
                      </div>
                      <div>
                        <p className="font-medium">{subject.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {subject.worksheets} worksheets
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-lg">{subject.progress}%</span>
                  </div>
                  <Progress value={subject.progress} className="h-2" />
                </div>
              ))}
            </div>
          </Card>

          {/* AI Recommendations */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[#6366f1]" />
              <h3 className="text-lg font-semibold">AI Recommendations</h3>
            </div>
            <div className="space-y-4">
              {aiRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-primary-light border border-primary/20"
                >
                  <h4 className="font-semibold mb-2">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="outline">{rec.difficulty}</Badge>
                      <span className="text-muted-foreground">
                        {rec.questions} questions
                      </span>
                    </div>
                    <Button size="sm" variant="outline">
                      Start
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full gap-2">
                More Recommendations
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
