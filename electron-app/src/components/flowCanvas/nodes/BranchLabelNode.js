import React, { memo } from "react";

const BranchLabelNode = ({ data, style }) => {
  return (
    <div style={{ 
        ...style, 
        pointerEvents: 'none', // Click-through
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        letterSpacing: '1px',
    }}>
      {data.label}
    </div>
  );
};

export default memo(BranchLabelNode);