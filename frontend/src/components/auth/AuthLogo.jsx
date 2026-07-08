import BrandLogo from '../brand/BrandLogo'

export default function AuthLogo({ className = '' }) {
  return (
    <BrandLogo
      variant="mark"
      showText={false}
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl transition hover:-translate-y-0.5 ${className}`}
      imageClassName="h-full w-full object-contain"
      markClassName="h-14 w-14 rounded-2xl text-base shadow-lg shadow-[#00b14f]/25"
    />
  )
}
