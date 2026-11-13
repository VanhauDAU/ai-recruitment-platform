import { BankOutlined } from '@ant-design/icons'
import { Card, Empty, Image, Space, Tag, Typography } from 'antd'
import { COMPANY_HTML_FIELDS } from '@/entities/employer-profile'
import { ProfileFieldGrid, ProfileRichTextBlock } from './profile-field-display'

const IDENTITY_LABELS = {
  public_id: 'Mã công ty',
  slug: 'Đường dẫn định danh',
  legal_name: 'Tên pháp lý',
  trade_name: 'Tên thương mại',
  trade_name_same_as_registered: 'Tên thương mại trùng tên pháp lý',
  business_type: 'Loại hình doanh nghiệp',
  tax_code: 'Mã số thuế',
  company_size: 'Quy mô',
  founded_year: 'Năm thành lập',
  primary_industry: 'Lĩnh vực chính',
}

const CONTACT_LABELS = {
  address: 'Địa chỉ',
  website_url: 'Website',
  has_no_website: 'Đánh dấu không có website',
  email: 'Email doanh nghiệp',
  phone: 'Điện thoại doanh nghiệp',
}

const OPERATION_LABELS = {
  markets: 'Thị trường',
  target_customers: 'Khách hàng mục tiêu',
  has_no_logo: 'Đánh dấu không có logo',
  has_brand_page: 'Trang thương hiệu riêng',
}

const SYSTEM_LABELS = {
  created_by_email: 'Người tạo hồ sơ',
  created_by_public_id: 'Mã người tạo',
  created_at: 'Ngày tạo hồ sơ',
  updated_at: 'Cập nhật gần nhất',
}

function CompanyVisual({ company }) {
  const companyName = company.trade_name || company.legal_name || 'Công ty'
  return (
    <section className="account-company-visual" aria-label="Hình ảnh nhận diện công ty">
      <div className="account-company-visual__cover">
        {company.cover_image_url ? (
          <Image src={company.cover_image_url} alt={`Ảnh bìa ${companyName}`} />
        ) : (
          <div className="account-company-visual__placeholder"><BankOutlined /><span>Chưa có ảnh bìa</span></div>
        )}
      </div>
      <div className="account-company-visual__identity">
        <div className="account-company-visual__logo">
          {company.logo_url ? <Image src={company.logo_url} alt={`Logo ${companyName}`} /> : <BankOutlined />}
        </div>
        <div>
          <Typography.Title level={4}>{companyName}</Typography.Title>
          <Typography.Text type="secondary">{company.legal_name || 'Chưa cập nhật tên pháp lý'}</Typography.Text>
        </div>
      </div>
    </section>
  )
}

function CompanyIndustries({ industries = [] }) {
  return (
    <section className="account-company-section">
      <h4>Lĩnh vực hoạt động</h4>
      {industries.length > 0 ? (
        <Space wrap size={[6, 6]}>
          {industries.map((industry) => (
            <Tag key={industry.id || industry.name} color={industry.is_primary ? 'green' : 'default'}>
              {industry.name}{industry.is_primary ? ' · Chính' : ''}
            </Tag>
          ))}
        </Space>
      ) : <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>}
    </section>
  )
}

function CompanyGallery({ images = [] }) {
  return (
    <section className="account-company-section">
      <div className="account-company-section__heading">
        <h4>Thư viện ảnh công ty</h4>
        <Tag>{`${images.length} ảnh`}</Tag>
      </div>
      {images.length > 0 ? (
        <Image.PreviewGroup>
          <div className="account-company-gallery">
            {images.map((image, index) => (
              <figure key={image.id || image.image_url}>
                <Image src={image.image_url} alt={image.caption || `Ảnh công ty ${index + 1}`} />
                <figcaption>{image.caption || `Ảnh công ty ${index + 1}`}</figcaption>
              </figure>
            ))}
          </div>
        </Image.PreviewGroup>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa cập nhật ảnh thư viện" />}
    </section>
  )
}

export default function CompanyProfileCard({ company }) {
  return (
    <Card
      className="account-profile__card"
      title="Thông tin công ty"
    >
      <CompanyVisual company={company} />
      <section className="account-company-section"><h4>Nhận diện và pháp lý</h4><ProfileFieldGrid data={company} labels={IDENTITY_LABELS} /></section>
      <section className="account-company-section"><h4>Thông tin liên hệ</h4><ProfileFieldGrid data={company} labels={CONTACT_LABELS} /></section>
      <section className="account-company-section"><h4>Hoạt động và hiển thị</h4><ProfileFieldGrid data={company} labels={OPERATION_LABELS} /></section>
      <CompanyIndustries industries={company.industries} />
      {[...COMPANY_HTML_FIELDS].map((field) => (
        <ProfileRichTextBlock
          key={field}
          label={field === 'description' ? 'Giới thiệu công ty' : 'Phúc lợi nhân viên'}
          html={company[field]}
        />
      ))}
      <CompanyGallery images={company.images} />
      <section className="account-company-section"><h4>Thông tin hệ thống</h4><ProfileFieldGrid data={company} labels={SYSTEM_LABELS} /></section>
    </Card>
  )
}
