import { useState } from "react";
import { useMood } from "../context";
import { Button, Field, Modal } from "./UI";
import { parseMoney } from "../domain/money";
import { cloudCall } from "../services/cloud";
export default function TripEditor() {
  const { trip, state, isOwner, saving, cloud, updateTrip, updateApp, notify } =
    useMood();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="flex flex-wrap justify-end gap-3 my-4">
        <Button
          variant="secondary"
          disabled={!isOwner}
          onClick={() => {
            setEditing(true);
            setError("");
          }}
        >
          编辑旅行信息
        </Button>
        <Button
          variant="ghost"
          disabled={!isOwner}
          onClick={() => setDeleting(true)}
        >
          删除这场旅行
        </Button>
      </div>
      {editing && (
        <Modal title="让旅行更像你想要的样子" onClose={() => setEditing(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const budgetMinor = parseMoney(String(f.get("budget")));
                if (
                  await updateTrip((t) => ({
                    ...t,
                    title: String(f.get("title")).trim(),
                    destination: String(f.get("destination")).trim(),
                    startDate: String(f.get("date")),
                    budgetMinor,
                  }))
                )
                  setEditing(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Field label="旅行名称">
              <input
                name="title"
                required
                maxLength={50}
                defaultValue={trip.title}
              />
            </Field>
            <Field label="目的地">
              <input
                name="destination"
                required
                maxLength={40}
                defaultValue={trip.destination}
              />
            </Field>
            <Field label="出发日期">
              <input
                name="date"
                type="date"
                required
                defaultValue={trip.startDate}
              />
            </Field>
            <Field label="旅行预算（元）">
              <input
                name="budget"
                defaultValue={trip.budgetMinor / 100}
                required
              />
            </Field>
            <p className="form-note">
              移动出发日期后，行程费用预估日期随之调整；实际账单和清单日期保持原记录。
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={saving} type="submit">
              保存旅行信息
            </Button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="删除整场旅行？"
          description={`「${trip.title}」的行程、账单、清单与照片都会删除。请先导出备份。已分享的本地快照无法撤回。`}
          onClose={() => setDeleting(false)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              保留旅行
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (cloud)
                    await cloudCall("deleteTrip", {
                      tripId: trip.id,
                      expectedVersion: trip.version,
                    });
                  if (
                    !updateApp((s) => ({
                      ...s,
                      trips: s.trips.filter((t) => t.id !== trip.id),
                      activeTripId:
                        s.trips.find((t) => t.id !== trip.id)?.id || "",
                    }))
                  )
                    return;
                  setDeleting(false);
                  notify("旅行已删除");
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认删除整场旅行
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
