/**
 * Barrel export — shadcn/ui components + legacy shim wrappers.
 */

// ── shadcn re-exports ──
export { Button } from '@/components/ui/button';
export { Badge } from '@/components/ui/badge';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
export { Input } from '@/components/ui/input';
export { Textarea } from '@/components/ui/textarea';
export { Label } from '@/components/ui/label';
export { Skeleton } from '@/components/ui/skeleton';
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export { Separator } from '@/components/ui/separator';
export { ScrollArea } from '@/components/ui/scroll-area';

// ── Legacy shim wrappers ──
export { FormField, type FormFieldProps } from './FormField';
export { FormInput, type FormInputProps } from './FormInput';
export { FormTextarea, type FormTextareaProps } from './FormTextarea';
export { Dropdown, optionsFromLabels, type DropdownProps, type DropdownOption } from './Dropdown';
export { DatePicker, type DatePickerProps } from './DatePicker';
export { GridCell, type GridCellProps } from './GridCell';
export { ImagePreview, type ImagePreviewProps } from './ImagePreview';
export { EmptyState } from './EmptyState';
export { MarkdownText } from './MarkdownText';
export { StatusBar } from './StatusBar';
