# python manage.py dbshell
# .tables # lists tables
# DROP TABLE home_homepage;

python manage.py dumpdata > datadump.json
# change DATABASES backend
python manage.py migrate --run-syncdb
python manage.py shell
from django.contrib.contenttypes.models import ContentType
ContentType.objects.all().delete()
quit()
python manage.py loaddata datadump.json

# python manage.py sqlflush | CASCADE on truncate in database | manage.py loaddata