"use client";

import { useState } from "react";
import {
  deleteCampaignAction,
  deleteGeneratedPostAction,
  deletePersonaAction,
  deleteRecommendationAction,
  deleteReferencePostAction,
  deleteTalkingPointAction,
  deleteTopicAction,
  deleteUserAction
} from "@/app/actions";

type DeleteTarget =
  | {
      type: "generatedPost";
      id: string;
    }
  | {
      type: "referencePost";
      id: string;
    }
  | {
      type: "campaign";
      id: string;
    }
  | {
      type: "recommendation";
      id: string;
    }
  | {
      type: "topic";
      id: string;
    }
  | {
      type: "talkingPoint";
      id: string;
    }
  | {
      type: "persona";
      id: string;
    }
  | {
      type: "user";
      id: string;
    };

export function DeleteConfirmForm({
  message = "Are you sure you want to delete this?",
  target
}: {
  message?: string;
  target: DeleteTarget;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteConfig = {
    generatedPost: {
      action: deleteGeneratedPostAction,
      idFieldName: "generatedPostId"
    },
    referencePost: {
      action: deleteReferencePostAction,
      idFieldName: "id"
    },
    campaign: {
      action: deleteCampaignAction,
      idFieldName: "campaignId"
    },
    recommendation: {
      action: deleteRecommendationAction,
      idFieldName: "recommendationId"
    },
    topic: {
      action: deleteTopicAction,
      idFieldName: "topicId"
    },
    talkingPoint: {
      action: deleteTalkingPointAction,
      idFieldName: "talkingPointId"
    },
    persona: {
      action: deletePersonaAction,
      idFieldName: "personaId"
    },
    user: {
      action: deleteUserAction,
      idFieldName: "userId"
    }
  }[target.type];

  return (
    <>
      <button className="danger" type="button" onClick={() => setIsOpen(true)}>
        Delete
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal confirm-modal" role="dialog">
            <div>
              <h3>Confirm delete</h3>
              <p className="muted">{message}</p>
            </div>
            <div className="split-actions">
              <form action={deleteConfig.action} data-success-message="Successfully deleted">
                <input name={deleteConfig.idFieldName} type="hidden" value={target.id} />
                <button className="danger" type="submit">
                  Yes
                </button>
              </form>
              <button className="secondary" type="button" onClick={() => setIsOpen(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
