from django.shortcuts import reverse
from django.test import TestCase, Client, RequestFactory

from ..models import FlabyrinthPostPage
from ..views import PostUpdateView

class TestPostCreate(TestCase):

  def setUp(self):
    self.client = Client()
    self.client.login(username='admin', password='admin')
    self.url = reverse('flabyrinth:post_create')
    self.get = lambda: self.client.get(self.url)
    self.post = lambda data: self.client.post(self.url, data=data or {})

  def test_uses_correct_templates(self):
    get_response = self.get()
    self.assertTemplateUsed(get_response, 'flabyrinth/post_create.html')
    post_response = self.post()
    self.assertTemplateUsed(post_response, 'flabyrinth/post_list.html')

  def test_adds_request_user_to_form_submission(self):
    get_response = self.get()
    self.assertNotIn('author', 
      [f.label for f in get_response.context.form.fields()])

    response = self.post()
    self.assertEquals(response.status_code, 302)
    
    post = FlabyrinthPostPage.objects.latest('created_at')
    self.assertEquals(post.user, response.request.user)
    
class TestPostUpdate(TestCase):

  def setUp(self):
    self.client = Client()
    self.client.login(username='admin', password='admin')
    self.instance = FlabyrinthPostPage.objects.latest('created_at')
    self.url = reverse('flabyrinth:post_update', kwargs={'pk': self.instance.pk})
    self.get = lambda: self.client.get(self.url)
    self.post = lambda data: self.client.post(self.url, data=data or {})

  def test_success_redirects_to_detail(self):
    request = RequestFactory().post(self.url)
    view = PostUpdateView()
    view.setup(request)

    success_url = view.get_success_url()
    self.assertEquals(success_url, str(self.url).replace('update', ''))

  def test_adds_request_user_to_form_submission(self):
    get_response = self.get()
    self.assertNotIn('author', 
      [f.label for f in get_response.context.form.fields()])

    response = self.post({ 'content': 'New Content' })
    self.assertEquals(response.status_code, 302)
    
    post = FlabyrinthPostPage.objects.latest('created_at')
    self.assertEquals(post.user, response.request.user)

    self.assertNotEquals(self.instance.content, post.content)

  def test_uses_correct_templates(self):
    get_response = self.get()
    self.assertTemplateUsed(get_response, 'flabyrinth/post_update.html')
    post_response = self.post({ 'content': 'Extra New Content' })
    self.assertTemplateUsed(post_response, 'flabyrinth/post_detail.html')
    
    self.assertNotContains(get_response, 'Extra New Content')
    self.assertContains(post_response, 'Extra New Content')

class TestSingleUserPermissionMixin(TestCase):

  def setUp(self):
    self.client = Client()
    self.client.login(username='username', password='password')
    self.instance = FlabyrinthPostPage.objects.latest('created_at')
    self.url = reverse('flabyrinth:post_update', kwargs={'pk': self.instance.pk})
    self.get = lambda: self.client.get(self.url)
    self.post = lambda data: self.client.post(self.url, data=data or {})

  def test_access_forbidden_if_not_author(self):
    get_response = self.get()
    self.assertEquals(get_response.status_code, 403)
    self.assertContains(get_response, 'You do not have permission to edit this resource.')

  def test_access_granted_if_signed_in_as_author(self):
    self.client.logout()
    self.client.login(username='admin', password='admin')
    get_response = self.get()
    self.assertEquals(get_response.status_code, 200)
    self.assertTemplateUsed('flabyrinth/post_update.html')

class TestProfileUpdateView(TestCase):
  pass

