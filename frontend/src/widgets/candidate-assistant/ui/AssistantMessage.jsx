import { ProcvMascot } from '@/shared/ui/mascot'

export default function AssistantMessage({ actions = [], from, onAction, text }) {
  const assistant = from === 'assistant'
  return (
    <div className={`assistant-message ${assistant ? 'assistant-message--bot' : 'assistant-message--user'}`}>
      {assistant && (
        <span className="assistant-message__avatar">
          <ProcvMascot size={29} emotion="happy" />
        </span>
      )}
      <div className="assistant-message__wrap">
        <div
          className={`assistant-message__bubble assistant-message-in ${assistant
            ? 'assistant-message__bubble--bot'
            : 'assistant-message__bubble--user'
          }`}
        >
          {text}
        </div>
        {assistant && actions.length > 0 && (
          <div className="assistant-message__actions">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id)}
                className="assistant-message__action"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
