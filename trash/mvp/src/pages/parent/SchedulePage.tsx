import { getSession } from "@/lib/auth";
import { listBookingsByChild, listChildrenByParent, listClasses, listClassTypes, listLocations } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import type { Booking, SwimClass } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BookingWithClass {
  booking: Booking;
  cls: SwimClass;
}

export default function ParentSchedulePage() {
  const session = getSession();
  const children = session ? listChildrenByParent(session.userId).filter((c) => c.isActive) : [];
  const classes = listClasses();
  const locations = listLocations();
  const classTypes = listClassTypes();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Jadwal Anak</h1>
      {children.map((child) => {
        const bookings: BookingWithClass[] = listBookingsByChild(child.id)
          .map((b) => ({ booking: b, cls: classes.find((c) => c.id === b.classId) }))
          .filter((x): x is BookingWithClass => x.cls !== undefined)
          .sort((a, b) => a.cls.startTime.localeCompare(b.cls.startTime));

        return (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle>{child.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada jadwal kelas.</p>
              ) : (
                bookings.map(({ booking, cls }) => {
                  const location = locations.find((l) => l.id === cls.locationId);
                  const classType = classTypes.find((t) => t.id === cls.classTypeId);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{classType?.name ?? "Kelas"}</p>
                        <p className="text-muted-foreground">
                          {formatDateTime(cls.startTime)} — {formatTime(cls.endTime)} · {location?.name}
                        </p>
                      </div>
                      <Badge variant={booking.isAttended ? "success" : "outline"}>
                        {booking.isAttended ? "Hadir" : "Belum Hadir"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data anak terdaftar.</p>
      ) : null}
    </div>
  );
}
