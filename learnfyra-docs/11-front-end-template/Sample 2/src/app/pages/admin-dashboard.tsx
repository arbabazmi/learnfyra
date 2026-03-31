import { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Download,
  UserPlus,
  Settings,
  TrendingUp,
  FileText,
  Activity,
  Shield,
  Edit,
  Trash2,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const [selectedRole, setSelectedRole] = useState('all');

  const platformStats = [
    { metric: 'Total Users', value: 52847, change: '+12%', icon: Users },
    { metric: 'Active Today', value: 8234, change: '+5%', icon: Activity },
    { metric: 'Worksheets', value: 125680, change: '+23%', icon: FileText },
    {
      metric: 'Avg Performance',
      value: '87%',
      change: '+3%',
      icon: TrendingUp,
    },
  ];

  const userGrowth = [
    { month: 'Jan', students: 35000, teachers: 1200, parents: 8500 },
    { month: 'Feb', students: 38000, teachers: 1350, parents: 9200 },
    { month: 'Mar', students: 42000, teachers: 1500, parents: 10200 },
    { month: 'Apr', students: 45000, teachers: 1700, parents: 11000 },
    { month: 'May', students: 48500, teachers: 1950, parents: 11800 },
  ];

  const users = [
    {
      id: 1,
      name: 'Priya Sharma',
      email: 'priya.sharma@email.com',
      role: 'student',
      grade: '7',
      status: 'active',
      joined: '2025-01-15',
      activity: 24,
    },
    {
      id: 2,
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@school.com',
      role: 'teacher',
      grade: '7A, 7B',
      status: 'active',
      joined: '2024-08-20',
      activity: 87,
    },
    {
      id: 3,
      name: 'Anjali Patel',
      email: 'anjali.patel@email.com',
      role: 'parent',
      grade: '7, 5',
      status: 'active',
      joined: '2025-01-10',
      activity: 45,
    },
    {
      id: 4,
      name: 'Arjun Verma',
      email: 'arjun.verma@email.com',
      role: 'student',
      grade: '8',
      status: 'active',
      joined: '2024-09-05',
      activity: 32,
    },
    {
      id: 5,
      name: 'Meera Joshi',
      email: 'meera.joshi@email.com',
      role: 'student',
      grade: '6',
      status: 'inactive',
      joined: '2024-10-12',
      activity: 8,
    },
    {
      id: 6,
      name: 'Vikram Singh',
      email: 'vikram.singh@school.com',
      role: 'teacher',
      grade: '6A, 6B, 6C',
      status: 'active',
      joined: '2024-07-15',
      activity: 102,
    },
  ];

  const filteredUsers =
    selectedRole === 'all'
      ? users
      : users.filter((user) => user.role === selectedRole);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'student':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'teacher':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'parent':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <AppLayout userRole="admin">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, monitor platform health, and view analytics
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </Button>
            <Button size="lg" className="gap-2">
              <UserPlus className="w-5 h-5" />
              Add User
            </Button>
          </div>
        </div>

        {/* Platform Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    {stat.change}
                  </Badge>
                </div>
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.metric}</p>
              </Card>
            );
          })}
        </div>

        {/* User Growth Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">User Growth</h3>
              <p className="text-sm text-muted-foreground">
                Monthly user registration trends
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="students" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="teachers" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="parents" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
              <span className="text-sm text-muted-foreground">Students</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
              <span className="text-sm text-muted-foreground">Teachers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10b981]" />
              <span className="text-sm text-muted-foreground">Parents</span>
            </div>
          </div>
        </Card>

        {/* User Management */}
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">User Management</h3>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="teacher">Teachers</SelectItem>
                    <SelectItem value="parent">Parents</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Grade/Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getRoleBadgeColor(user.role)}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.grade}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{user.activity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.joined}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <Edit className="w-4 h-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Shield className="w-4 h-4" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive">
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* System Health */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">System Status</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  All systems operational
                </p>
                <Badge variant="secondary" className="bg-green-50 text-green-700">
                  Healthy
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">AI Model</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  GPT-4 (99.8% uptime)
                </p>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  Active
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Security</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Last scan: 2 hours ago
                </p>
                <Badge
                  variant="secondary"
                  className="bg-purple-50 text-purple-700"
                >
                  Secure
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
