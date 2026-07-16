import { CompressOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function CanvasZoomControls({ zoom, onIn, onOut, onFit }) {
  return <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-lg"><Button shape="circle" aria-label="Thu nhỏ" icon={<MinusOutlined />} onClick={onOut} /><span className="w-12 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span><Button shape="circle" aria-label="Phóng to" icon={<PlusOutlined />} onClick={onIn} /><Button shape="circle" aria-label="Vừa khung" icon={<CompressOutlined />} onClick={onFit} /></div>
}
