import * as React from 'react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { FileX2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
import { Input } from './Input';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;
  filters?: React.ReactNode;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue,
  filters,
  hasMore,
  onLoadMore,
  emptyTitle = 'No results found',
  emptyDescription = 'Try adjusting your search or filters.',
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {(onSearch || filters) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {onSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={e => onSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filters && <div className="flex gap-2 flex-wrap">{filters}</div>}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={FileX2} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columns.map(col => (
                    <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, i) => (
                  <TableRow key={i}>
                    {columns.map(col => (
                      <TableCell key={col.key} className={col.className}>{col.render(item)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && onLoadMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={onLoadMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
