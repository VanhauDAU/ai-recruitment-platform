import { CloseOutlined, SearchOutlined } from '@ant-design/icons'

export default function KnowledgeSearchBox({ search, statusText }) {
  return (
    <form className="knowledge-search" role="search" onSubmit={search.submit}>
      <label htmlFor="knowledge-search-input" className="sr-only">
        Tìm trong trung tâm trợ giúp
      </label>
      <SearchOutlined className="knowledge-search__icon" aria-hidden="true" />
      <input
        id="knowledge-search-input"
        type="search"
        value={search.input}
        onChange={(event) => search.setInput(event.target.value)}
        placeholder="Nhập câu hỏi hoặc từ khóa bạn cần hỗ trợ..."
        autoComplete="off"
      />
      {search.input && (
        <button
          type="button"
          className="knowledge-search__clear"
          aria-label="Xóa từ khóa tìm kiếm"
          onClick={search.clear}
        >
          <CloseOutlined />
        </button>
      )}
      <button type="submit" className="knowledge-search__submit">
        Tìm kiếm
      </button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusText}
      </span>
    </form>
  )
}
