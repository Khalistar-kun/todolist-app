# Component Library Documentation

## Button Components

### Primary Button
```tsx
// components/Button/PrimaryButton.tsx
import React from 'react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  onClick,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors ${className}`}
    >
      {children}
    </button>
  );
};
```

### Secondary Button
```tsx
export const SecondaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  onClick,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-all ${className}`}
    >
      {children}
    </button>
  );
};
```

## Card Components

### Basic Card
```tsx
// components/Card/Card.tsx
interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      {children}
    </div>
  );
};
```

## Form Components

### Input Field
```tsx
// components/Form/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};
```

## Layout Components

### Container
```tsx
// components/Layout/Container.tsx
export const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};
```

### Grid
```tsx
// components/Layout/Grid.tsx
interface GridProps {
  children: React.ReactNode;
  cols?: number;
  gap?: number;
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  children,
  cols = 3,
  gap = 6,
  className = '',
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-${gap} ${className}`}
    >
      {children}
    </div>
  );
};
```

## Usage Examples

### Landing Page Example
```tsx
import { Container, Grid, Card, PrimaryButton } from '@/components';

export default function LandingPage() {
  return (
    <Container className="py-12">
      <h1 className="text-4xl font-bold mb-8">Welcome</h1>
      <Grid cols={3} gap={6}>
        <Card title="Feature 1">
          <p>Description of feature 1</p>
          <PrimaryButton>Learn More</PrimaryButton>
        </Card>
        <Card title="Feature 2">
          <p>Description of feature 2</p>
          <PrimaryButton>Learn More</PrimaryButton>
        </Card>
        <Card title="Feature 3">
          <p>Description of feature 3</p>
          <PrimaryButton>Learn More</PrimaryButton>
        </Card>
      </Grid>
    </Container>
  );
}
```
