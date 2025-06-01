"use client";

import React, { useCallback, forwardRef, memo } from "react";

const ActionButton = memo(
  ({ record, onToggleEditMode, initialEditMode, isPaid, onPayButtonClick, getButtonRef }) => {
    const handleEditClick = useCallback(() => {
      onToggleEditMode(record.record_id);
    }, [record.record_id, onToggleEditMode]);

    const handlePayClick = useCallback(() => {
      onPayButtonClick(record.record_id);
    }, [record.record_id, onPayButtonClick]);

    if (initialEditMode) {
      return (
        <button
          className="bg-green-500 text-white px-2 py-1 rounded text-sm"
          onClick={handleEditClick}
        >
          저장
        </button>
      );
    } else if (isPaid) {
      return (
        <button
          className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
          onClick={handleEditClick}
        >
          수정
        </button>
      );
    } else {
      return (
        <button
          className="bg-indigo-500 text-white px-2 py-1 rounded text-sm"
          onClick={handlePayClick}
          ref={(el) => getButtonRef && getButtonRef(el)}
        >
          지급처리
        </button>
      );
    }
  }
);

export default ActionButton;
