import { EyeOutlined } from '@ant-design/icons'
import { Image } from 'antd'

export default function CompanyGallery({ items, title }) {
  const preview = { cover: <span><EyeOutlined aria-hidden="true" /> Xem ảnh</span> }

  return (
    <Image.PreviewGroup>
      <ul className="company-profile-gallery">
        {items.map((item, index) => (
          <li key={`${item.image_url}-${index}`}>
            <figure>
              <Image
                src={item.image_url}
                alt={item.caption || `${title} ${index + 1}`}
                loading="lazy"
                preview={preview}
                classNames={{ root: 'company-profile-gallery__frame', image: 'company-profile-gallery__image' }}
              />
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
    </Image.PreviewGroup>
  )
}
