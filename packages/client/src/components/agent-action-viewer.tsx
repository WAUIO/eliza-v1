import type { UUID } from '@elizaos/core';
import {
  Bot,
  Brain,
  ImagePlusIcon,
  Trash2,
  LoaderIcon,
  Search,
  Clock,
  Database,
  Zap,
  Activity,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentActions, useDeleteLog } from '@/hooks/use-query-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { HierarchicalCard, CardSection, cardColors, type CardAction, type CardMetadata } from '@/components/ui/hierarchical-card';

// Constants
const ITEMS_PER_PAGE = 15;

// Enums
enum ActionType {
  all = 'all',
  llm = 'llm',
  transcription = 'transcription',
  image = 'image',
  other = 'other',
}

// Types
type AgentLog = {
  id?: string;
  type?: string;
  timestamp?: number;
  message?: string;
  details?: string;
  roomId?: string;
  body?: {
    modelType?: string;
    modelKey?: string;
    params?: any;
    response?: any;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  createdAt?: number;
  [key: string]: any;
};

type ActionCardProps = {
  action: AgentLog;
  onDelete?: (logId: string) => void;
};

type AgentActionViewerProps = {
  agentId: UUID;
  roomId?: UUID;
};

// Helper functions
function getModelUsageType(modelType: string): string {
  if (
    (modelType.includes('TEXT') || modelType.includes('OBJECT')) &&
    !modelType.includes('EMBEDDING') &&
    !modelType.includes('TRANSCRIPTION')
  ) {
    return 'LLM';
  }
  if (modelType.includes('EMBEDDING')) {
    return 'Embedding';
  }
  if (modelType.includes('TRANSCRIPTION')) {
    return 'Transcription';
  }
  if (modelType.includes('IMAGE')) {
    return 'Image';
  }
  if (
    !modelType.includes('TEXT') &&
    !modelType.includes('IMAGE') &&
    !modelType.includes('EMBEDDING') &&
    !modelType.includes('TRANSCRIPTION')
  ) {
    return 'Other';
  }
  return 'Unknown';
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function getModelIcon(modelType = '') {
  if (modelType.includes('TEXT_EMBEDDING')) return Brain;
  if (modelType.includes('TRANSCRIPTION')) return FileText;
  if (modelType.includes('TEXT') || modelType.includes('OBJECT')) return Bot;
  if (modelType.includes('IMAGE')) return ImagePlusIcon;
  return Activity;
}

function getModelColor(modelType = '') {
  if (modelType.includes('TEXT') || modelType.includes('OBJECT')) return 'bg-emerald-600/80';
  if (modelType.includes('IMAGE')) return 'bg-amber-600/80';
  if (modelType.includes('TRANSCRIPTION')) return 'bg-blue-600/80';
  return 'bg-slate-500';
}

function formatTokenUsage(usage: any) {
  if (!usage) return null;

  const { prompt_tokens, completion_tokens, total_tokens } = usage;
  if (!total_tokens) return null;

  return {
    prompt: prompt_tokens || 0,
    completion: completion_tokens || 0,
    total: total_tokens,
  };
}

function truncateText(text: string, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(console.error);
}

function groupActionsByDate(actions: AgentLog[]) {
  const groups: Record<string, AgentLog[]> = {};

  for (const action of actions) {
    const timestamp = action.createdAt || action.timestamp || 0;
    const date = new Date(timestamp);
    const dateKey = date.toLocaleDateString();

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(action);
  }

  return groups;
}

// Components
function ActionCard({ action, onDelete }: ActionCardProps) {
  const [showFullParams, setShowFullParams] = useState(false);
  const [showFullResponse, setShowFullResponse] = useState(false);

  const modelType = action.body?.modelType || '';
  const modelKey = action.body?.modelKey || '';
  const IconComponent = getModelIcon(modelType);
  const usageType = getModelUsageType(modelType);
  const tokenUsage = formatTokenUsage(action.body?.response?.usage || action.body?.usage);

  const renderParams = () => {
    const params = action.body?.params;
    if (!params) return null;

    if (modelType.includes('TRANSCRIPTION') && Array.isArray(params)) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Audio input data</span>
        </div>
      );
    }

    const paramsText =
      typeof params === 'object' ? JSON.stringify(params, null, 2) : String(params);
    const isLong = paramsText.length > 200;

    return (
      <CardSection title="Parameters" collapsible={isLong}>
        <div className="relative group">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
            {showFullParams || !isLong ? paramsText : truncateText(paramsText, 200)}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(paramsText)}
            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy parameters"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </CardSection>
    );
  };

  const renderResponse = () => {
    const response = action.body?.response;
    if (!response) return null;

    if (response === '[array]') {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3 w-3" />
          <span>Array response data</span>
        </div>
      );
    }

    const responseText =
      typeof response === 'object' ? JSON.stringify(response, null, 2) : String(response);
    const isLong = responseText.length > 300;

    return (
      <CardSection title="Response" collapsible={isLong}>
        <div className="relative group max-h-64 overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
            {showFullResponse || !isLong ? responseText : truncateText(responseText, 300)}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(responseText)}
            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy response"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </CardSection>
    );
  };

  const hasExtendedContent =
    action.body?.params || action.body?.response || action.message || action.details;

  // Build metadata array
  const metadata: CardMetadata[] = [];

  if (modelKey) {
    metadata.push({
      icon: Zap,
      text: modelKey,
      className: 'font-mono bg-surface-overlay px-1 border border-border-subtle rounded-none'
    });
  }

  metadata.push({
    icon: Clock,
    text: formatDate(action.createdAt || action.timestamp)
  });

  if (action.id) {
    metadata.push({
      text: `• ${action.id.slice(-8)}`,
      className: 'text-[10px] bg-surface-overlay border border-border-subtle px-1 rounded-none'
    });
  }

  // Add token usage to metadata
  if (tokenUsage) {
    metadata.push({
      text: `Tokens: ${tokenUsage.total.toLocaleString()}`,
      className: 'font-mono'
    });
    if (tokenUsage.prompt > 0) {
      metadata.push({
        text: `In: ${tokenUsage.prompt.toLocaleString()}`,
        className: 'font-mono text-text-muted'
      });
    }
    if (tokenUsage.completion > 0) {
      metadata.push({
        text: `Out: ${tokenUsage.completion.toLocaleString()}`,
        className: 'font-mono text-text-muted'
      });
    }
  }

  // Build actions array
  const actions: CardAction[] = [];

  if (action.id && onDelete) {
    actions.push({
      icon: Trash2,
      onClick: () => {
        if (typeof action.id === 'string') {
          onDelete(action.id);
        }
      },
      tooltip: 'Delete log entry',
      className: 'text-status-error hover:text-status-error hover:bg-status-error/10'
    });
  }

  // Preview content for collapsed state
  const previewContent = hasExtendedContent ? (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <AlertCircle className="h-3 w-3" />
      <span>
        {action.body?.params && action.body?.response
          ? 'Contains parameters and response data'
          : action.body?.params
            ? 'Contains parameter data'
            : 'Contains response data'}
      </span>
    </div>
  ) : undefined;

  return (
    <HierarchicalCard
      indicatorColor={getModelColor(modelType)}
      indicatorHeight="h-20"
      icon={IconComponent}
      title={usageType}
      badges={[{ text: modelType }]}
      metadata={metadata}
      actions={actions}
      expandable={hasExtendedContent}
      previewContent={previewContent}
    >
      {renderParams()}
      {renderResponse()}

      {/* Additional metadata */}
      {(action.message || action.details) && (
        <CardSection title="Additional Info">
          {action.message && (
            <div className="text-xs mb-2">
              <span className="font-medium text-text-muted">Message: </span>
              <span className="text-text-primary">{action.message}</span>
            </div>
          )}
          {action.details && (
            <div className="text-xs">
              <span className="font-medium text-text-muted">Details: </span>
              <span className="text-text-primary">{action.details}</span>
            </div>
          )}
        </CardSection>
      )}
    </HierarchicalCard>
  );
}

function LoadingIndicator({
  loadingMore,
  onLoadMore,
}: {
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex justify-center py-6">
      {loadingMore ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading more actions...</span>
        </div>
      ) : (
        <Button variant="outline" onClick={onLoadMore} className="px-8">
          Load More
        </Button>
      )}
    </div>
  );
}

function EmptyState({
  selectedType,
  searchQuery,
}: {
  selectedType: ActionType;
  searchQuery: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
      <Database className="h-16 w-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium mb-2">No Actions Found</h3>
      <p className="text-muted-foreground max-w-md mb-4">
        {searchQuery
          ? `No actions match "${searchQuery}". Try adjusting your search or filter.`
          : selectedType === ActionType.all
            ? 'Actions will appear here once the agent has performed operations.'
            : `No ${selectedType} actions found.`}
      </p>
      {searchQuery && (
        <Button variant="outline" onClick={() => { }}>
          Clear Search
        </Button>
      )}
    </div>
  );
}

export function AgentActionViewer({ agentId, roomId }: AgentActionViewerProps) {
  const [selectedType, setSelectedType] = useState<ActionType>(ActionType.all);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Exclude embedding operations by default
  const excludeTypes = ['embedding', 'text_embedding'];

  const { data: actions = [], isLoading, error } = useAgentActions(agentId, roomId, excludeTypes);
  const { mutate: deleteLog } = useDeleteLog();

  // Filter and search actions
  const filteredActions = actions.filter((action: AgentLog) => {
    // Type filter
    if (selectedType !== ActionType.all) {
      const modelType = action.body?.modelType || '';
      const usageType = getModelUsageType(modelType);

      switch (selectedType) {
        case ActionType.llm:
          if (usageType !== 'LLM') return false;
          break;
        case ActionType.transcription:
          if (usageType !== 'Transcription') return false;
          break;
        case ActionType.image:
          if (usageType !== 'Image') return false;
          break;
        case ActionType.other:
          if (usageType !== 'Other' && usageType !== 'Unknown') return false;
          break;
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchableText = [
        action.body?.modelType,
        action.body?.modelKey,
        action.id,
        action.message,
        JSON.stringify(action.body?.params),
        JSON.stringify(action.body?.response),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    }

    return true;
  });

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || visibleItems >= filteredActions.length) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 200;

    if (scrolledToBottom) {
      setLoadingMore(true);
      setTimeout(() => {
        setVisibleItems((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredActions.length));
        setLoadingMore(false);
      }, 500);
    }
  }, [loadingMore, visibleItems, filteredActions.length]);

  // Reset visible items when filter changes
  useEffect(() => {
    setVisibleItems(ITEMS_PER_PAGE);
  }, [selectedType, searchQuery]);

  // Set up scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const visibleActions = filteredActions.slice(0, visibleItems);
  const hasMoreToLoad = visibleItems < filteredActions.length;
  const actionGroups = groupActionsByDate(visibleActions);

  const handleDelete = (logId: string) => {
    if (window.confirm('Are you sure you want to delete this log entry?')) {
      deleteLog({ agentId, logId });
    }
  };

  const handleLoadMore = () => {
    setVisibleItems((prev) => prev + ITEMS_PER_PAGE);
  };

  // Loading state
  if (isLoading && actions.length === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-100px)] min-h-[400px] w-full">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-4">
            <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-medium">Loading Actions</h3>
              <p className="text-sm text-muted-foreground">Fetching agent action history...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-[calc(100vh-100px)] min-h-[400px] w-full">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Database className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-medium text-destructive">Failed to Load Actions</h3>
            <p className="text-sm text-muted-foreground">
              There was an error loading the agent actions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[400px] w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-4 pt-4 flex-none border-b pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium"> Actions</h3>
          {!isLoading && (
            <span className="ml-2 text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
              {filteredActions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          {/* Filter */}
          <Select
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as ActionType)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ActionType.all}>All Actions</SelectItem>
              <SelectItem value={ActionType.llm}>LLM Calls</SelectItem>
              <SelectItem value={ActionType.transcription}>Transcriptions</SelectItem>
              <SelectItem value={ActionType.image}>Image Operations</SelectItem>
              <SelectItem value={ActionType.other}>Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4">
        {filteredActions.length === 0 ? (
          <EmptyState selectedType={selectedType} searchQuery={searchQuery} />
        ) : (
          <div className="space-y-4">
            {Object.entries(actionGroups).map(([date, actions]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3 py-2">
                  <Separator className="flex-1" />
                  <span className="text-sm font-medium text-muted-foreground px-2">{date}</span>
                  <Separator className="flex-1" />
                </div>
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <ActionCard key={action.id || index} action={action} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMoreToLoad && (
              <LoadingIndicator loadingMore={loadingMore} onLoadMore={handleLoadMore} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
