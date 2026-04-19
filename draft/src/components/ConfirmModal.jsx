// 確認モーダルコンポーネント
import './ConfirmModal.css';

export default function ConfirmModal({ isOpen, title, message, children, onConfirm, onCancel, confirmLabel = '確定', cancelLabel = 'キャンセル', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">
          {cancelLabel && (
            <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          )}
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
