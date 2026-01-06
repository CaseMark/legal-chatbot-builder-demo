"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  ArrowClockwise,
  Trash,
  MagnifyingGlass,
  CaretDown,
  CaretUp,
  Warning,
  CheckCircle,
  Clock,
  Lightning,
  File,
  ChartBar,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserUsage {
  userId: string;
  session: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
  };
  daily: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
    ocrPages: number;
    ocrPagesLimit: number;
    ocrPagesPercent: number;
    resetTime: string;
  };
  monthly: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
    resetTime: string;
  };
  lastActivity: string;
  requestCount: number;
}

interface LimitHitLog {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  limitType: string;
  limit: number;
  used: number;
  message: string;
}

interface AdminStats {
  totalUsers: number;
  activeToday: number;
  limitHitsToday: number;
  totalTokensToday: number;
  totalOcrPagesToday: number;
}

interface AdminPanelProps {
  adminKey: string;
  className?: string;
}

export function AdminPanel({ adminKey, className }: AdminPanelProps) {
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [limitHits, setLimitHits] = useState<LimitHitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"userId" | "lastActivity" | "daily.tokens">("lastActivity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedTab, setSelectedTab] = useState<"users" | "logs" | "stats">("users");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/admin/limits", {
        headers: {
          "x-admin-key": adminKey,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized: Invalid admin key");
        }
        throw new Error("Failed to fetch admin data");
      }

      const data = await response.json();
      setUsers(data.users || []);
      setStats(data.stats || null);
      setLimitHits(data.limitHits || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResetUser = async (userId: string, resetType: "session" | "daily" | "all") => {
    try {
      const response = await fetch("/api/admin/limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          action: "reset_user",
          userId,
          resetType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset user limits");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset user");
    }
  };

  const handleClearAllUsers = async () => {
    if (!confirm("Are you sure you want to clear all user tracking data? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          action: "clear_all",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear user data");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear data");
    }
  };

  // Filter and sort users
  const filteredUsers = users
    .filter((user) =>
      user.userId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === "daily.tokens") {
        aVal = a.daily.tokens;
        bVal = b.daily.tokens;
      } else if (sortField === "lastActivity") {
        aVal = new Date(a.lastActivity).getTime();
        bVal = new Date(b.lastActivity).getTime();
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <CaretUp className="h-3 w-3" />
    ) : (
      <CaretDown className="h-3 w-3" />
    );
  };

  const formatPercent = (percent: number) => {
    if (percent >= 90) return "text-red-600 dark:text-red-400";
    if (percent >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <ArrowClockwise className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Warning className="mb-2 h-8 w-8 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
            <ArrowClockwise className="h-4 w-4" data-icon="inline-start" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Admin Panel</h2>
          <p className="text-sm text-muted-foreground">
            View and manage user limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
          >
            <ArrowClockwise
              className={cn("h-4 w-4", refreshing && "animate-spin")}
              data-icon="inline-start"
            />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAllUsers}
          >
            <Trash className="h-4 w-4" data-icon="inline-start" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.activeToday}</p>
                <p className="text-xs text-muted-foreground">Active Today</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <Warning className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats.limitHitsToday}</p>
                <p className="text-xs text-muted-foreground">Limit Hits Today</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <Lightning className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {(stats.totalTokensToday / 1000).toFixed(1)}k
                </p>
                <p className="text-xs text-muted-foreground">Tokens Today</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <File className="h-8 w-8 text-teal-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalOcrPagesToday}</p>
                <p className="text-xs text-muted-foreground">OCR Pages Today</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: "users", label: "Users", icon: Users },
          { id: "logs", label: "Limit Hits", icon: ChartBar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              selectedTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {selectedTab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">User Usage</CardTitle>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-md border bg-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 && "s"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th
                      className="cursor-pointer p-2 hover:bg-muted/50"
                      onClick={() => toggleSort("userId")}
                    >
                      <div className="flex items-center gap-1">
                        User ID
                        <SortIcon field="userId" />
                      </div>
                    </th>
                    <th
                      className="cursor-pointer p-2 hover:bg-muted/50"
                      onClick={() => toggleSort("daily.tokens")}
                    >
                      <div className="flex items-center gap-1">
                        Daily Tokens
                        <SortIcon field="daily.tokens" />
                      </div>
                    </th>
                    <th className="p-2">Session</th>
                    <th className="p-2">OCR Pages</th>
                    <th
                      className="cursor-pointer p-2 hover:bg-muted/50"
                      onClick={() => toggleSort("lastActivity")}
                    >
                      <div className="flex items-center gap-1">
                        Last Active
                        <SortIcon field="lastActivity" />
                      </div>
                    </th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.userId} className="border-b hover:bg-muted/30">
                      <td className="p-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {user.userId.length > 20
                            ? `${user.userId.slice(0, 20)}...`
                            : user.userId}
                        </code>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                user.daily.tokensPercent >= 90
                                  ? "bg-red-500"
                                  : user.daily.tokensPercent >= 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              )}
                              style={{ width: `${Math.min(100, user.daily.tokensPercent)}%` }}
                            />
                          </div>
                          <span className={formatPercent(user.daily.tokensPercent)}>
                            {user.daily.tokens.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={formatPercent(user.session.tokensPercent)}>
                          {user.session.tokens.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={formatPercent(user.daily.ocrPagesPercent)}>
                          {user.daily.ocrPages}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(user.lastActivity).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleResetUser(user.userId, "session")}
                          >
                            Reset Session
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleResetUser(user.userId, "daily")}
                          >
                            Reset Daily
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limit Hits Log Tab */}
      {selectedTab === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Limit Hits</CardTitle>
            <CardDescription>
              Log of users who hit their limits (analytics)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              {limitHits.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No limit hits recorded yet
                </p>
              ) : (
                <div className="space-y-2">
                  {limitHits.map((hit) => (
                    <div
                      key={hit.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <Warning className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {hit.limitType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(hit.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{hit.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          User: <code>{hit.userId.slice(0, 20)}...</code> |
                          Used: {hit.used.toLocaleString()} / {hit.limit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Admin panel page wrapper that checks for admin key
 */
export function AdminPanelPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/admin/limits", {
        headers: {
          "x-admin-key": adminKey,
        },
      });

      if (response.ok) {
        setAuthenticated(true);
        // Store in session
        sessionStorage.setItem("admin-key", adminKey);
      } else {
        setError("Invalid admin key");
      }
    } catch {
      setError("Failed to authenticate");
    }
  };

  // Check for stored admin key on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem("admin-key");
    if (storedKey) {
      setAdminKey(storedKey);
      setAuthenticated(true);
    }
  }, []);

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>
              Enter your admin key to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Admin key"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full">
                Access Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4">
      <AdminPanel adminKey={adminKey} />
    </div>
  );
}
