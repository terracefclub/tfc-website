from django.urls import path
from website.flabyrinth.views import (
  ProfileDetailView, ProfileListView, ProfileUpdateView, 
  PostListView, PostCreateView, PostDetailView, PostUpdateView,
  account_profile, mentorship
)

urlpatterns = [
  path('profile/', account_profile, name='profile'),
  path('profile/edit/', ProfileUpdateView.as_view(), name='profile_update'),
  path('profiles/<str:slug>/', 
    ProfileDetailView.as_view(), name='profile_detail'),
  path('profiles/', ProfileListView.as_view(), name='profile_list'),
  path('profiles/mentorship/', mentorship, name='mentorship'),
  path('posts/', PostListView.as_view(), name='post_list'),
  path('posts/create/', PostCreateView.as_view(), name='post_create'),
  path('posts/<int:pk>/', PostDetailView.as_view(), name='post_detail'),
  path('posts/<int:pk>/edit', PostUpdateView.as_view(), name='post_update'),
]