'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  Calendar,
  User,
  AlertCircle,
  Clock,
  CheckCircle2,
  Mail,
  UserCheck,
  Filter,
  ChevronUp,
  ChevronDown
} from 'lucide-react'

// Import shadcn/ui components
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

interface Task {
  id: number
  title: string
  description: string
  due_date: string
  priority: string
  assignee_id: number
  assigned_by: number
  department_id: number
  created_at: string
  assigned_by_name?: string
  assigned_at?: string
  updated_at?: string
  status?: string
  assignee_name?: string
  assignee_email?: string
  department_name?: string
}

const getPriorityVariant = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'destructive'
    case 'medium':
      return 'default'
    case 'low':
      return 'secondary'
    default:
      return 'outline'
  }
}

const getStatusVariant = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'outline'
    case 'in_progress':
      return 'default'
    case 'completed':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return <Clock className="w-3 h-3" />
    case 'in_progress':
      return <AlertCircle className="w-3 h-3" />
    case 'completed':
      return <CheckCircle2 className="w-3 h-3" />
    default:
      return <Clock className="w-3 h-3" />
  }
}

// Status options for different roles
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]
const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' }
]

const Tasks = () => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [userDepartment, setUserDepartment] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [overdueFilter, setOverdueFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc') // desc = recent first
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)

  // Fetch user role and department
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user?.id) return

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('role, department_id')
          .eq('id', user.id)
          .single()

        if (error) throw error

        setUserRole(userData.role)
        setUserDepartment(userData.department_id)
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [user])

  // Fetch tasks based on user role
  useEffect(() => {
    const fetchTasks = async () => {
      if (!user?.id || !userRole) return

      setLoadingTasks(true)

      try {
        let query = supabase.from('tasks').select(`
          *,
          assigned_by_name,
          assigned_at,
          updated_at,
          status
        `)

        if (userRole === 'admin') {
          // Admin: see all tasks
          // No filter needed
        } else if (userRole === 'leader') {
          // Leader: see tasks related to his department
          if (userDepartment !== null) {
            query = query.eq('department_id', userDepartment)
          } else {
            // If no department, show nothing
            query = query.eq('id', -1)
          }
        } else if (userRole === 'employee') {
          // Employee: only see tasks assigned to himself
          query = query.eq('assignee_id', user.id)
        }

        const { data: tasksData, error } = await query.order('due_date', { ascending: sortOrder === 'asc' })

        if (error) throw error

        const tasksWithAssignees = await Promise.all(
          (tasksData || []).map(async (task) => {
            const { data: assigneeData } = await supabase
              .from('users')
              .select('full_name, email')
              .eq('id', task.assignee_id)
              .single()

            return {
              ...task,
              assignee_name: assigneeData?.full_name || 'Unknown User',
              assignee_email: assigneeData?.email || '',
            }
          })
        )

        setTasks(tasksWithAssignees)
        setFilteredTasks(tasksWithAssignees)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      } finally {
        setLoadingTasks(false)
      }
    }

    fetchTasks()
  }, [user, userRole, userDepartment, sortOrder])

  // Filter tasks based on status and priority
  useEffect(() => {
    let filtered = tasks

    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status?.toLowerCase() === statusFilter)
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority.toLowerCase() === priorityFilter)
    }
    
    if (overdueFilter !== 'all') {
      const now = new Date()
      if (overdueFilter === 'overdue') {
        filtered = filtered.filter(task => new Date(task.due_date) < now && new Date(task.due_date).toDateString() !== now.toDateString())
      } else if (overdueFilter === 'not_overdue') {
        filtered = filtered.filter(task => new Date(task.due_date) >= now || new Date(task.due_date).toDateString() === now.toDateString())
      }
    }

    // Sort completed tasks to bottom and apply shadow effect
    filtered = filtered.sort((a, b) => {
      if (a.status?.toLowerCase() === 'completed' && b.status?.toLowerCase() !== 'completed') {
        return 1
      }
      if (a.status?.toLowerCase() !== 'completed' && b.status?.toLowerCase() === 'completed') {
        return -1
      }
      return 0
    })

    setFilteredTasks(filtered)
  }, [tasks, statusFilter, priorityFilter, overdueFilter])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString()
  }

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Handle status change
  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (task.status?.toLowerCase() === newStatus) return
    setUpdatingStatusId(task.id)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error

      // Update local state
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
        )
      )
    } catch (error) {
      console.error('Error updating status:', error)
      // Optionally show error to user
    } finally {
      setUpdatingStatusId(null)
    }
  }

  // Determine if user can change status for a given task
  const canChangeStatus = (task: Task) => {
    if (userRole === 'admin' || userRole === 'leader') return true
    if (userRole === 'employee' && user?.id === task.assignee_id) {
      // Employee can only change status to 'pending' or 'in_progress'
      return true
    }
    return false
  }

  // Get allowed status options for a given task
  const getAllowedStatusOptions = (task: Task) => {
    if (userRole === 'admin' || userRole === 'leader') {
      return STATUS_OPTIONS
    }
    if (userRole === 'employee' && user?.id === task.assignee_id) {
      return EMPLOYEE_STATUS_OPTIONS
    }
    return []
  }

  if (loadingTasks) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 sm:w-1/4 mb-6"></div>
          <div className="bg-muted rounded h-48 sm:h-96"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Active Tasks</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {userRole === 'admin'
              ? 'All tasks in the system'
              : userRole === 'leader'
                ? 'Tasks in your department'
                : userRole === 'employee'
                  ? 'Tasks assigned to you'
                  : ''
            }
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {/* Only show filters for status, priority, overdue */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 sm:w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-28 sm:w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={overdueFilter} onValueChange={setOverdueFilter}>
            <SelectTrigger className="w-28 sm:w-32">
              <SelectValue placeholder="Overdue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="not_overdue">Not Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="text-center p-6 sm:p-12">
          <div className="text-muted-foreground mb-2">
            {tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}
          </div>
          <div className="text-sm text-muted-foreground/70">
            {userRole === 'admin'
              ? 'No tasks in the system'
              : userRole === 'leader'
                ? 'No tasks in your department'
                : userRole === 'employee'
                  ? 'No tasks assigned to you'
                  : ''
            }
          </div>
        </Card>
      ) : (
        <>
          {/* Table Container */}
          <div className="rounded-lg border overflow-x-auto">
            {/* Responsive Table: Hide table on small screens, show cards instead */}
            <div className="hidden md:block">
              <table className="w-full min-w-[700px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-medium text-muted-foreground">
                      Task Details
                    </th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-medium text-muted-foreground">
                      Assignee
                    </th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-medium text-muted-foreground">
                      Status & Priority
                    </th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={toggleSortOrder}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Due Date
                        {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task, index) => {
                    const isCompleted = task.status?.toLowerCase() === 'completed'
                    const isEven = index % 2 === 0
                    const canEditStatus = canChangeStatus(task)
                    const allowedStatusOptions = getAllowedStatusOptions(task)
                    const isEmployee = userRole === 'employee'
                    const isOwnTask = user?.id === task.assignee_id

                    return (
                      <tr 
                        key={task.id}
                        className={`
                          border-b transition-all hover:bg-muted/30 
                          ${isCompleted ? 'opacity-50 shadow-sm' : ''}
                          ${isEven ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-yellow-100/50 dark:bg-yellow-800/30'}
                          ${isOverdue(task.due_date) && !isCompleted ? 'border-l-4 border-l-destructive' : ''}
                        `}
                      >
                        {/* Task Details */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="space-y-1">
                            <Link 
                              href={`/pages/task-detail/${task.id}`}
                              className="text-xs sm:text-sm font-medium hover:text-primary transition-colors cursor-pointer line-clamp-2"
                            >
                              {task.title}
                            </Link>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                                {task.description}
                              </p>
                            )}
                            {task.assigned_by_name && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <UserCheck className="w-3 h-3" />
                                <span>by {task.assigned_by_name}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Assignee */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-medium truncate">
                                {task.assignee_name || 'Unknown User'}
                              </div>
                              {task.assignee_email && (
                                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {task.assignee_email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status & Priority */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="flex flex-col gap-2">
                            {/* Status: editable if allowed */}
                            {canEditStatus && allowedStatusOptions.length > 0 ? (
                              <Select
                                value={task.status?.toLowerCase() || 'pending'}
                                onValueChange={value => handleStatusChange(task, value)}
                                disabled={updatingStatusId === task.id}
                              >
                                <SelectTrigger className="w-32 text-xs">
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(task.status || 'pending')}
                                    <span className="text-xs capitalize">{task.status || 'Pending'}</span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {allowedStatusOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-1">
                                        {getStatusIcon(opt.value)}
                                        <span className="text-xs capitalize">{opt.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={getStatusVariant(task.status || 'pending')} className="flex items-center gap-1 w-fit">
                                {getStatusIcon(task.status || 'pending')}
                                <span className="text-xs">{task.status || 'Pending'}</span>
                              </Badge>
                            )}
                            <Badge variant={getPriorityVariant(task.priority)} className="text-xs w-fit">
                              {task.priority}
                            </Badge>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className={`text-xs sm:text-sm font-medium ${isOverdue(task.due_date) && !isCompleted ? 'text-destructive' : ''}`}>
                                {formatDate(task.due_date)}
                              </span>
                              {isOverdue(task.due_date) && !isCompleted && (
                                <Badge variant="destructive" className="text-xs">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            {task.assigned_at && (
                              <div className="text-xs text-muted-foreground">
                                Assigned: {formatDateTime(task.assigned_at)}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile Card List */}
            <div className="block md:hidden">
              <div className="flex flex-col gap-3">
                {filteredTasks.map((task, index) => {
                  const isCompleted = task.status?.toLowerCase() === 'completed'
                  const isOver = isOverdue(task.due_date) && !isCompleted
                  const canEditStatus = canChangeStatus(task)
                  const allowedStatusOptions = getAllowedStatusOptions(task)
                  return (
                    <Card
                      key={task.id}
                      className={`
                        p-3 sm:p-4 border
                        ${isCompleted ? 'opacity-50 shadow-sm' : ''}
                        ${isOver ? 'border-l-4 border-l-destructive' : ''}
                        bg-yellow-50 dark:bg-yellow-900/20
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/pages/task-detail/${task.id}`}
                          className="text-base font-semibold hover:text-primary transition-colors cursor-pointer line-clamp-2"
                        >
                          {task.title}
                        </Link>
                        <div className="flex flex-col items-end gap-1">
                          {/* Status: editable if allowed */}
                          {canEditStatus && allowedStatusOptions.length > 0 ? (
                            <Select
                              value={task.status?.toLowerCase() || 'pending'}
                              onValueChange={value => handleStatusChange(task, value)}
                              disabled={updatingStatusId === task.id}
                            >
                              <SelectTrigger className="w-32 text-xs">
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(task.status || 'pending')}
                                  <span className="text-xs capitalize">{task.status || 'Pending'}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {allowedStatusOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-1">
                                      {getStatusIcon(opt.value)}
                                      <span className="text-xs capitalize">{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getStatusVariant(task.status || 'pending')} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(task.status || 'pending')}
                              <span className="text-xs">{task.status || 'Pending'}</span>
                            </Badge>
                          )}
                          <Badge variant={getPriorityVariant(task.priority)} className="text-xs w-fit">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">
                            {task.assignee_name || 'Unknown User'}
                          </div>
                          {task.assignee_email && (
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {task.assignee_email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className={`text-xs font-medium ${isOver ? 'text-destructive' : ''}`}>
                          {formatDate(task.due_date)}
                        </span>
                        {isOver && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {task.assigned_by_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <UserCheck className="w-3 h-3" />
                          <span>by {task.assigned_by_name}</span>
                        </div>
                      )}
                      {task.assigned_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Assigned: {formatDateTime(task.assigned_at)}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <Card className="bg-muted/30">
            <CardContent className="py-2 sm:py-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-muted-foreground gap-1">
                <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
                <span>Last updated: {new Date().toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default Tasks