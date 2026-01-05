import calendar
from datetime import datetime, timedelta
from calendar import HTMLCalendar

class Calendar(HTMLCalendar):
    def __init__(self, year=None, month=None):
        self.year = year
        self.month = month
        super(Calendar, self).__init__()

    def formatday(self, day, weekday):
        if day == 0:
            return '<td class="noday">&nbsp;</td>'
        else:
            return f'<td class="day">{day}</td>'

    def formatweek(self, theweek):
        week = ''
        for d, wd in theweek:
            week += self.formatday(d, wd)
        return f'<tr>{week}</tr>'

    def formatmonth(self, withyear=True):
        cal = f'<table border="0" cellpadding="0" cellspacing="0" class="calendar">\n'
        cal += f'{self.formatweekheader()}\n'
        for week in self.monthdays2calendar(self.year, self.month):
            cal += f'{self.formatweek(week)}\n'
        cal += '</table>'
        return cal