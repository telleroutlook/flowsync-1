import React, { memo } from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'none';
}

const baseClasses = 'bg-secondary/20 rounded';

const variantClasses = {
  text: 'rounded-sm h-4',
  circular: 'rounded-full',
  rectangular: 'rounded-md',
};

const animationClasses = {
  pulse: 'animate-pulse',
  none: '',
};

export const Skeleton = memo<SkeletonProps>(({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}) => {
  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`;

  const customStyle: React.CSSProperties = {
    width,
    height,
    ...style,
  };

  return <div className={combinedClasses} style={customStyle} {...props} aria-hidden="true" />;
});
Skeleton.displayName = 'Skeleton';

// Predefined skeleton components for common patterns
export const TaskCardSkeleton = memo(() => (
  <div className="bg-surface p-4 rounded-xl border border-border-subtle/60 shadow-sm">
    <div className="flex justify-between items-start mb-3">
      <div className="flex-1">
        <Skeleton width="60%" height={16} className="mb-2" />
        <Skeleton width="40%" height={12} />
      </div>
      <Skeleton variant="circular" width={24} height={24} />
    </div>
    <div className="space-y-2 mb-3">
      <Skeleton width="100%" height={12} />
      <Skeleton width="80%" height={12} />
    </div>
    <div className="flex justify-between items-center pt-2 border-t border-border-subtle/30">
      <Skeleton variant="circular" width={20} height={20} />
      <Skeleton width={60} height={12} />
    </div>
  </div>
));
TaskCardSkeleton.displayName = 'TaskCardSkeleton';

export const TableRowSkeleton = memo(({ rows = 5 }: { rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-b border-border-subtle/30">
        <td className="py-3 px-3"><Skeleton width={40} height={16} /></td>
        <td className="py-3 px-3"><Skeleton width="70%" height={16} /></td>
        <td className="py-3 px-3"><Skeleton width={50} height={16} /></td>
        <td className="py-3 px-3"><Skeleton width={60} height={20} variant="rectangular" /></td>
        <td className="py-3 px-3"><Skeleton width={80} height={16} /></td>
        <td className="py-3 px-3"><Skeleton width={40} height={16} /></td>
      </tr>
    ))}
  </>
));
TableRowSkeleton.displayName = 'TableRowSkeleton';

export const GanttBarSkeleton = memo(({ count = 5 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="h-11 border-b border-border-subtle/10 flex items-center px-4"
        style={{ animationDelay: `${i * 50}ms` }}
      >
        <Skeleton width="60%" height={16} />
      </div>
    ))}
  </>
));
GanttBarSkeleton.displayName = 'GanttBarSkeleton';
