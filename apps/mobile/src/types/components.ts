/**
 * Component prop type definitions
 * Industrial UI components optimized for glove operation
 */

export interface IndustrialButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'large' | 'xlarge';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  testID?: string;
}

export interface UserSelectorProps {
  users: Array<{
    id: string;
    name: string;
    role: 'operator' | 'supervisor';
  }>;
  onUserSelect: (name: string) => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  testID?: string;
}