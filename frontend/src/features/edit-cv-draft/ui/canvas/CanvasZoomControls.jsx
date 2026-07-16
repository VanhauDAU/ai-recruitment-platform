import { CompressOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function CanvasZoomControls({ zoom, onIn, onOut, onFit }) {
  return <div className="fixed bottom-20 right-3 z-40 flex w-fit items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1 shadow-lg lg:bottom-5 lg:right-5"><Button size="small" type="text" shape="circle" aria-label="Thu nhỏ" icon={<MinusOutlined />} onClick={onOut} /><span className="w-11 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span><Button size="small" type="text" shape="circle" aria-label="Phóng to" icon={<PlusOutlined />} onClick={onIn} /><Button size="small" type="text" shape="circle" aria-label="Vừa khung" icon={<CompressOutlined />} onClick={onFit} /></div>
}
