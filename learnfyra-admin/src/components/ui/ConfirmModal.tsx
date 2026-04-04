import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  confirmValue?: string; // If set, user must type this exact value to confirm
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmText = 'Confirm', confirmValue, variant = 'danger', loading,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const canConfirm = confirmValue ? inputValue === confirmValue : true;

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} description={description}>
      <div className="space-y-4">
        {variant === 'danger' && (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertTriangle className="size-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">This action cannot be undone.</p>
          </div>
        )}

        {confirmValue && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-mono font-semibold text-foreground">{confirmValue}</span> to confirm:
            </p>
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={confirmValue}
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
