from django.views.generic import ListView, CreateView, DetailView, UpdateView

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.utils.functional import cached_property

from django.http import HttpResponseForbidden
from django.shortcuts import render
from django.urls import reverse_lazy, reverse

from django.core.exceptions import ImproperlyConfigured

from django.forms import modelform_factory, HiddenInput
from website.flabyrinth.widgets import UserTinyMCE

from django.contrib.auth.models import User
from website.flabyrinth.models import (
  Profile, FlabyrinthPostPage, MentorProfile, MenteeProfile
)


class SingleUserPermissionMixin():
  """
  View mixin for models with a unique user field allowing only the associated
  user to access the endpoint, returning a forbidden response otherwise.
  """
  user_field = None   # the string field representing a unique user for instance

  def get_object_user(self):
    """ Retrieve the actual user instance for the detail instance object """
    if self.user_field is None: # must actually define `user_field` to use
      raise ImproperlyConfigured(
        "Must define user_field to use %(cls)s correctly." % {
          'cls': self.__class__.__name__
        }
      )

    # supports typical django nested dunder syntax
    attrs = self.user_field.split('__')
    obj = self.get_object()
    for attr in attrs:
      obj = getattr(obj, attr)
    return obj

  def dispatch(self, request, *args, **kwargs):
    """ Gives forbidden response if requesting user doesn't match instance """
    if request.user != self.get_object_user():
      return HttpResponseForbidden(
        'You do not have permission to edit this resource.')
    return super().dispatch(request, *args, **kwargs)

@login_required
def account_profile(request):
  """ For viewing one's own profile -- request.user in template """
  context = {}
  return render(request, 'flabyrinth/profile.html', context)

@login_required
def mentorship(request):
  """ List view for viewing all mentor and mentee profiles """
  context = {
    'mentors': MentorProfile.objects.order_by('profile__user__username'),
    'mentees': MenteeProfile.objects.order_by('profile__user__username')
  } 
  return render(request, 'flabyrinth/mentorship.html', context)

class ProfileUpdateView(
  LoginRequiredMixin, UpdateView, SingleUserPermissionMixin
):
  """
  Updating profiles! The user must be logged in and and can only access theirs.
  Because the profile page is displayed with unique editing buttons for each
  field, this view is designed to handle updating one field at a time.

  **Template**
  :template:`flabyrinth/profile_update_form.html`
  """
  model = Profile
  success_url = reverse_lazy('flabyrinth:profile')
  template_name = 'flabyrinth/profile_update_form.html'
  user_field = 'user'
  user_fields = ['first_name', 'last_name', 'email']
  model_fields = [ # define user fields and other profile fields on same level
    field.name for field in Profile._meta.fields if field.name != 'user'
  ] + user_fields

  @cached_property
  def is_user_field(self):
    """ Update fields on user model attached to profile model instance """
    return any(field in self.fields for field in self.user_fields)

  @cached_property
  def fields(self):
    """ Redefine post fields to filter from list of profile and user fields """
    if self.request.method == 'GET':
      return self.request.GET.getlist('field')
    elif self.request.method == 'POST':
      keys = self.request.POST.keys()
      fields = [key for key in keys if key in self.model_fields]
      return fields
    else:
      raise NotImplementedError('This endpoint only supports GET and POST')

  def get_initial(self):
    """ Initialize all inputs with the actual current value """
    return {
      **super().get_initial(),
      **{ field: getattr(self.object, field) for field in self.fields }
    }

  def get_form_kwargs(self):
    """ 
    Update the form instance to the user object (not profile) if what is being 
    updated is a user field 
    """
    kwargs = super().get_form_kwargs()
    if self.is_user_field:
      kwargs.update({ 'instance': self.request.user })
    return kwargs

  def get_form(self):
    """ Pass form data to the model form """
    if self.is_user_field: # change view model instance
        self.model = User
    if self.request.method == 'GET':
      if 'bio' in self.fields:  # special template for bio
        self.template_name = 'flabyrinth/profile_update_bio_form.html'

      # generate modelform with hidden user input, bio TinyMC editor, and
      # whatever other field widget is needed
      return modelform_factory(
        self.model, 
        fields=['user']+self.fields if not self.is_user_field else self.fields, 
        widgets={ 'user': HiddenInput(), 'bio': UserTinyMCE() },
      )(**self.get_form_kwargs())
    return super().get_form_class()(**self.get_form_kwargs())

  def get_object(self):
    """ Actual detail instance -- used for SingleUserPermissionMixin """
    if self.is_user_field:
      return self.request.user
    return self.request.user.profile

  def dispatch(self, request, *args, **kwargs):
    """ Add CSP header for the bio edit iframe """
    response = super().dispatch(request, *args, **kwargs)
    if 'bio' in self.fields:
      response['Content-Security-Policy'] = "frame-ancestors 'self'"
    return response

class ProfileDetailView(LoginRequiredMixin, DetailView):
  model = Profile
  context_object_name = 'profile'
  slug_field = 'user__username'

class ProfileListView(LoginRequiredMixin, ListView):
  model = Profile

class PostCreateView(LoginRequiredMixin, CreateView):
  model = FlabyrinthPostPage
  fields = ['content']
  template_name = 'flabyrinth/post_create.html'
  success_url = reverse_lazy('flabyrinth:post_list')

  def form_valid(self, form):
    """ Add the requesting user to the instance (it is excluded from fields) """
    form.instance.user = self.request.user
    return super().form_valid(form)

class PostUpdateView(LoginRequiredMixin, UpdateView, SingleUserPermissionMixin):
  model = FlabyrinthPostPage
  user_field = 'author'
  fields = ['content']
  template_name = 'flabyrinth/post_update.html'
  context_object_name = 'post'
  
  def get_success_url(self):
    """ Redirect on success back to the updated post detail view """
    return reverse('flabyrinth:post_detail', kwargs={
      'pk': self.get_object().pk 
    })

  def form_valid(self, form):
    """ Add the requesting user to the instance (it is excluded from fields) """
    form.instance.user = self.request.user
    return super().form_valid(form)

class PostListView(LoginRequiredMixin, ListView):
  model = FlabyrinthPostPage
  paginate_by = 10
  template_name = 'flabyrinth/post_list.html'
  context_object_name = 'posts'

class PostDetailView(LoginRequiredMixin, DetailView):
  model = FlabyrinthPostPage
  context_object_name = 'post'
  template_name = 'flabyrinth/post_detail.html'