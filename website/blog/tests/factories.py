from factory import Faker, post_generation

from wagtail_factories.blocks import StreamFieldFactory
from website.tests.factories import DocumentChooserBlockFactory, PageChooserBlockFactory, RichTextBlockFactory, TagFactoryMixin

from factory import Sequence
from factory.declarations import RelatedFactory, SubFactory
from wagtail_factories.factories import PageFactory
from website.blog.models import BlogCategory, BlogIndexPage, BlogPage, BlogPageGalleryImage
from factory.django import DjangoModelFactory
from wagtail_factories import ImageFactory

class BlogCategoryFactory(DjangoModelFactory):
  class Meta:
    model = BlogCategory
  name = Sequence(lambda n: f'Blog Category {n}')
  icon = SubFactory(ImageFactory)

class BlogIndexPageFactory(PageFactory):
  class Meta:
    model = BlogIndexPage
  pinned_posts = StreamFieldFactory({
    'blog_page': PageChooserBlockFactory
  })

class BlogPageFactory(TagFactoryMixin, PageFactory):
  class Meta:
    model = BlogPage

  slug = Sequence(lambda n: f'blogpage_{n}')
  date = Faker('date')
  intro = Faker('text', max_nb_chars=250)
  body = StreamFieldFactory({
    'text': RichTextBlockFactory,
    'html': f'<p>{Faker("text", max_nb_chars=50)}</p>',
    'doc': DocumentChooserBlockFactory,
  })

  gallery_images = RelatedFactory(
    'website.blog.tests.factories.BlogPageGalleryImageFactory', 
    factory_related_name='page'
  )

  @post_generation
  def categories(self, create, extracted, **kwargs):
    if not create: return
    if extracted: # list of categories
      for category in extracted:
        self.categories.add(category)

class BlogPageGalleryImageFactory(DjangoModelFactory):
  class Meta:
    model = BlogPageGalleryImage
  page = SubFactory(BlogPageFactory)
  image = SubFactory(ImageFactory)
  caption = Faker('text', max_nb_chars=250)
 