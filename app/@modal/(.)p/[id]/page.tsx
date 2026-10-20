import { PostView } from "@/components/social/post-view";
import { Dialog } from "@/components/ui/dialog";

export default async function PostModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Dialog className="max-w-xl">
      <PostView id={id} />
    </Dialog>
  );
}

export const unstable_dynamicStaleTime = 0;
