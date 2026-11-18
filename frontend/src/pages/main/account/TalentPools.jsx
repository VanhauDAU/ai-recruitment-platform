import { MyTalentPools } from '@/features/main/application/withdraw-from-talent-pool'

export default function TalentPools() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Nhà tuyển dụng lưu hồ sơ của tôi</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Các nhà tuyển dụng giữ hồ sơ của bạn để mời ứng tuyển khi có vị trí phù hợp. Bạn có thể rút hồ sơ bất cứ lúc nào.
        </p>
      </header>
      <MyTalentPools />
    </section>
  )
}
